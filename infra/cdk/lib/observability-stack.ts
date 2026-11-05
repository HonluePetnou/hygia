import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as backup from 'aws-cdk-lib/aws-backup';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import type * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import type * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as events from 'aws-cdk-lib/aws-events';
import * as fis from 'aws-cdk-lib/aws-fis';
import * as iam from 'aws-cdk-lib/aws-iam';
import type * as kms from 'aws-cdk-lib/aws-kms';
import type * as rds from 'aws-cdk-lib/aws-rds';
import type * as sqs from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';

export interface ObservabilityStackProps extends StackProps {
  loadBalancer: elbv2.IApplicationLoadBalancer;
  deadLetterQueue: sqs.IQueue;
  dossiersService: ecs.FargateService;
  database: rds.IDatabaseCluster;
  leasesTable: dynamodb.ITable;
  backupKey: kms.IKey;
  /** Plafond mensuel du budget de démonstration, en dollars. */
  monthlyBudgetUsd: number;
  /** Destinataire des alertes de budget. */
  budgetEmail: string;
}

/**
 * Observabilité et résilience : tableau de bord et alarmes CloudWatch (traces X-Ray activées sur
 * chaque service), expérience de pannes FIS, sauvegardes AWS Backup, plafond AWS Budgets.
 */
export class ObservabilityStack extends Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    // Erreurs 5xx renvoyées par les services derrière l'ALB.
    const errors5xx = props.loadBalancer.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, {
      period: Duration.minutes(5),
    });
    const latencyP95 = props.loadBalancer.metrics.targetResponseTime({
      statistic: 'p95',
      period: Duration.minutes(5),
    });
    const deadLetters = props.deadLetterQueue.metricApproximateNumberOfMessagesVisible();

    const alarmErrors = new cloudwatch.Alarm(this, 'AlarmeErreurs', {
      metric: errors5xx,
      threshold: 10,
      evaluationPeriods: 1,
      alarmDescription: 'Plus de 10 erreurs 5xx en 5 minutes',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    new cloudwatch.Alarm(this, 'AlarmeLatence', {
      metric: latencyP95,
      threshold: 2,
      evaluationPeriods: 3,
      alarmDescription: 'Ouverture de dossier : p95 au-dessus de 2 s (objectif du cahier)',
    });
    new cloudwatch.Alarm(this, 'AlarmeLettresMortes', {
      metric: deadLetters,
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: 'Document en file de lettres mortes',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new cloudwatch.Dashboard(this, 'Tableau', {
      dashboardName: 'hygia',
      widgets: [
        [
          new cloudwatch.GraphWidget({ title: 'Latence p95 (ALB)', left: [latencyP95] }),
          new cloudwatch.GraphWidget({ title: 'Erreurs 5xx', left: [errors5xx] }),
          new cloudwatch.SingleValueWidget({ title: 'Lettres mortes', metrics: [deadLetters] }),
        ],
      ],
    });

    // Expérience de pannes (RF27) : arrêt de la moitié des tâches Dossiers ; arrêt automatique
    // si l'alarme d'erreurs se déclenche.
    const fisRole = new iam.Role(this, 'RoleFis', {
      assumedBy: new iam.ServicePrincipal('fis.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSFaultInjectionSimulatorECSAccess'),
      ],
    });
    new fis.CfnExperimentTemplate(this, 'PanneDossiers', {
      description: 'Arrête 50 % des tâches du service Dossiers',
      roleArn: fisRole.roleArn,
      stopConditions: [{ source: 'aws:cloudwatch:alarm', value: alarmErrors.alarmArn }],
      targets: {
        taches: {
          resourceType: 'aws:ecs:task',
          selectionMode: 'PERCENT(50)',
          parameters: {
            cluster: props.dossiersService.cluster.clusterName,
            service: props.dossiersService.serviceName,
          },
        },
      },
      actions: {
        arreter: { actionId: 'aws:ecs:stop-task', targets: { Tasks: 'taches' } },
      },
      tags: { Name: 'hygia-panne-dossiers' },
    });

    const vault = new backup.BackupVault(this, 'Coffre', { encryptionKey: props.backupKey });
    const plan = new backup.BackupPlan(this, 'Sauvegardes', {
      backupVault: vault,
      backupPlanRules: [
        new backup.BackupPlanRule({
          ruleName: 'quotidienne',
          scheduleExpression: events.Schedule.cron({ hour: '2', minute: '0' }),
          deleteAfter: Duration.days(35),
        }),
      ],
    });
    plan.addSelection('Donnees', {
      resources: [
        backup.BackupResource.fromRdsDatabaseCluster(props.database),
        backup.BackupResource.fromDynamoDbTable(props.leasesTable),
      ],
    });

    new budgets.CfnBudget(this, 'Budget', {
      budget: {
        budgetName: 'hygia-demonstration',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: props.monthlyBudgetUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: [80, 100].map((threshold) => ({
        notification: {
          notificationType: threshold === 100 ? 'FORECASTED' : 'ACTUAL',
          comparisonOperator: 'GREATER_THAN',
          threshold,
          thresholdType: 'PERCENTAGE',
        },
        subscribers: [{ subscriptionType: 'EMAIL', address: props.budgetEmail }],
      })),
    });
  }
}
