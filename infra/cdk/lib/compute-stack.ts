import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import type * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import type * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import type { Construct } from 'constructs';

export interface ComputeStackProps extends StackProps {
  vpc: ec2.IVpc;
  clinicalKey: kms.IKey;
  artifactsBucket: s3.IBucket;
  deadLetterQueue: sqs.IQueue;
}

/** Services conteneurisés : Fargate, 2 tâches réparties sur les 2 zones, derrière l'ALB interne. */
const FARGATE_SERVICES = [
  { name: 'dossiers', port: 3001, path: '/dossiers/*', priority: 10 },
  { name: 'ia-clinique', port: 3003, path: '/ia-clinique/*', priority: 20 },
  { name: 'synchronisation', port: 3009, path: '/synchronisation/*', priority: 30 },
] as const;

/** Étapes de la chaîne d'ingestion (tubes et filtres), une invocation Lambda chacune. */
const PIPELINE_STAGES = ['reception', 'ocr', 'normalisation', 'extraction', 'identifiants'] as const;

/**
 * Calcul : cluster ECS (Fargate) pour Dossiers, IA clinique, Synchronisation et le broker ; Lambda
 * pour ingestion, agents, notification et audit (code déposé par la CI dans le compartiment
 * d'artefacts) ; Step Functions pour la chaîne d'ingestion. X-Ray activé partout.
 */
export class ComputeStack extends Stack {
  readonly cluster: ecs.Cluster;
  readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  readonly brokerLoadBalancer: elbv2.NetworkLoadBalancer;
  readonly fargateServices: ecs.FargateService[] = [];
  readonly functions: Record<string, lambda.Function> = {};
  readonly pipeline: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    this.cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.vpc,
      containerInsightsV2: ecs.ContainerInsights.ENHANCED,
    });

    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: props.vpc,
      internetFacing: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });
    const listener = this.loadBalancer.addListener('Http', {
      port: 80,
      defaultAction: elbv2.ListenerAction.fixedResponse(404),
    });

    const service = (name: string, port: number) => {
      const repository = new ecr.Repository(this, `Image-${name}`, {
        repositoryName: `hygia/${name}`,
        imageScanOnPush: true,
        encryption: ecr.RepositoryEncryption.KMS,
        encryptionKey: props.clinicalKey,
      });
      const taskDefinition = new ecs.FargateTaskDefinition(this, `Tache-${name}`, {
        cpu: 512,
        memoryLimitMiB: 1024,
      });
      taskDefinition.addContainer(name, {
        image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
        portMappings: [{ containerPort: port }],
        logging: ecs.LogDrivers.awsLogs({
          streamPrefix: name,
          logGroup: new logs.LogGroup(this, `Journal-${name}`, {
            retention: logs.RetentionDays.ONE_MONTH,
            encryptionKey: props.clinicalKey,
          }),
        }),
        environment: { NODE_ENV: 'production', AWS_XRAY_DAEMON_ADDRESS: 'localhost:2000' },
      });
      taskDefinition.addContainer(`${name}-xray`, {
        image: ecs.ContainerImage.fromRegistry('public.ecr.aws/xray/aws-xray-daemon:latest'),
        portMappings: [{ containerPort: 2000, protocol: ecs.Protocol.UDP }],
        memoryReservationMiB: 64,
        essential: false,
      });
      const fargate = new ecs.FargateService(this, `Service-${name}`, {
        cluster: this.cluster,
        taskDefinition,
        desiredCount: 2,
        minHealthyPercent: 50,
        maxHealthyPercent: 200,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        circuitBreaker: { rollback: true },
      });
      this.fargateServices.push(fargate);
      return fargate;
    };

    for (const { name, port, path, priority } of FARGATE_SERVICES) {
      listener.addTargets(`Cible-${name}`, {
        port,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targets: [service(name, port)],
        conditions: [elbv2.ListenerCondition.pathPatterns([path])],
        priority,
        healthCheck: { path: '/health', interval: Duration.seconds(15) },
      });
    }

    // Broker : point d'entrée unique, derrière un NLB interne (lien VPC de l'API Gateway).
    const broker = service('broker', 3000);
    this.brokerLoadBalancer = new elbv2.NetworkLoadBalancer(this, 'NlbBroker', {
      vpc: props.vpc,
      internetFacing: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });
    this.brokerLoadBalancer.addListener('Tcp', { port: 80 }).addTargets('Broker', {
      port: 3000,
      targets: [broker],
      healthCheck: { protocol: elbv2.Protocol.HTTP, path: '/health' },
    });

    const fn = (name: string, runtime: lambda.Runtime, handler: string) => {
      const created = new lambda.Function(this, `Fonction-${name}`, {
        runtime,
        handler,
        // Paquet construit et déposé par la CI (`services/<nom>.zip`) avant le déploiement ; la CI
        // passe sa version d'objet en contexte (`-c version-<nom>=…`) pour forcer la mise à jour.
        code: lambda.Code.fromBucketV2(props.artifactsBucket, `services/${name}.zip`, {
          objectVersion: this.node.tryGetContext(`version-${name}`) as string | undefined,
        }),
        vpc: props.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        memorySize: 512,
        timeout: Duration.seconds(30),
        tracing: lambda.Tracing.ACTIVE,
        environmentEncryption: props.clinicalKey,
        logGroup: new logs.LogGroup(this, `JournalFn-${name}`, {
          retention: logs.RetentionDays.ONE_MONTH,
          encryptionKey: props.clinicalKey,
        }),
      });
      this.functions[name] = created;
      return created;
    };
    const ingestion = fn('ingestion', lambda.Runtime.NODEJS_22_X, 'dist/lambda.handler');
    fn('agents', lambda.Runtime.PYTHON_3_12, 'hygia_agents.lambda_handler.handler');
    fn('notification', lambda.Runtime.NODEJS_22_X, 'dist/lambda.handler');
    fn('audit', lambda.Runtime.NODEJS_22_X, 'dist/lambda.handler');

    // Chaîne d'ingestion : chaque filtre est une étape idempotente, rejouée 3 fois ; échec
    // définitif : le document part en file de lettres mortes.
    const toDeadLetters = new tasks.SqsSendMessage(this, 'VersLettresMortes', {
      queue: props.deadLetterQueue,
      messageBody: sfn.TaskInput.fromJsonPathAt('$'),
      messageGroupId: 'ingestion',
    });
    let chain: sfn.IChainable | undefined;
    let last: sfn.INextable | undefined;
    for (const stage of PIPELINE_STAGES) {
      const step = new tasks.LambdaInvoke(this, `Etape-${stage}`, {
        lambdaFunction: ingestion,
        payload: sfn.TaskInput.fromObject({ stage, 'document.$': '$.document' }),
        resultPath: `$.${stage}`,
      })
        .addRetry({ maxAttempts: 3, backoffRate: 2, interval: Duration.seconds(2) })
        .addCatch(toDeadLetters, { resultPath: '$.erreur' });
      if (last === undefined) chain = step;
      else last.next(step);
      last = step;
    }
    this.pipeline = new sfn.StateMachine(this, 'ChaineIngestion', {
      definitionBody: sfn.DefinitionBody.fromChainable(chain as sfn.IChainable),
      tracingEnabled: true,
      timeout: Duration.minutes(15),
    });
  }
}
