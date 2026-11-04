import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

export interface DataStackProps extends StackProps {
  vpc: ec2.IVpc;
}

/**
 * Données : une clé KMS par branche de la chaîne (clinique, analytique, audit) ; Aurora PostgreSQL
 * Multi-AZ (pgvector activé par migration : `CREATE EXTENSION vector`) dans les sous-réseaux
 * isolés ; S3 versionné ; journal d'audit en S3 Object Lock, mode conformité (WORM) ; DynamoDB
 * pour les baux du coordinateur des agents.
 */
export class DataStack extends Stack {
  readonly clinicalKey: kms.Key;
  readonly analyticsKey: kms.Key;
  readonly auditKey: kms.Key;
  readonly database: rds.DatabaseCluster;
  readonly documentsBucket: s3.Bucket;
  readonly auditBucket: s3.Bucket;
  readonly dataLakeBucket: s3.Bucket;
  readonly artifactsBucket: s3.Bucket;
  readonly leasesTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const key = (name: string, description: string) =>
      new kms.Key(this, name, {
        description,
        enableKeyRotation: true,
        removalPolicy: RemovalPolicy.RETAIN,
      });
    this.clinicalKey = key('CleClinique', 'HYGIA : branche clinique (dossiers, documents, messages)');
    this.analyticsKey = key('CleAnalytique', 'HYGIA : branche analytique (données pseudonymisées)');
    this.auditKey = key('CleAudit', "HYGIA : journal d'audit WORM");

    const dbSecurityGroup = new ec2.SecurityGroup(this, 'BaseSg', {
      vpc: props.vpc,
      description: 'Aurora : accessible depuis le VPC seulement',
      allowAllOutbound: false,
    });
    dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'PostgreSQL depuis les services du VPC',
    );

    // Une base logique par service (dossiers, identite…) dans le même cluster.
    this.database = new rds.DatabaseCluster(this, 'Aurora', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      writer: rds.ClusterInstance.serverlessV2('ecriture', { publiclyAccessible: false }),
      // Lecteur dans l'autre zone : Multi-AZ, bascule automatique.
      readers: [rds.ClusterInstance.serverlessV2('lecture', { scaleWithWriter: true, publiclyAccessible: false })],
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 4,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      storageEncrypted: true,
      storageEncryptionKey: this.clinicalKey,
      iamAuthentication: true,
      credentials: rds.Credentials.fromGeneratedSecret('hygia', { encryptionKey: this.clinicalKey }),
      defaultDatabaseName: 'dossiers',
      backup: { retention: Duration.days(14) },
      deletionProtection: true,
      cloudwatchLogsExports: ['postgresql'],
      removalPolicy: RemovalPolicy.SNAPSHOT,
    });

    const bucket = (name: string, encryptionKey: kms.IKey, extra: Partial<s3.BucketProps> = {}) =>
      new s3.Bucket(this, name, {
        encryption: s3.BucketEncryption.KMS,
        encryptionKey,
        bucketKeyEnabled: true,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        versioned: true,
        removalPolicy: RemovalPolicy.RETAIN,
        ...extra,
      });
    this.documentsBucket = bucket('Documents', this.clinicalKey);
    this.dataLakeBucket = bucket('LacAnalytique', this.analyticsKey);
    this.artifactsBucket = bucket('Artefacts', this.clinicalKey);
    this.auditBucket = bucket('Audit', this.auditKey, {
      objectLockEnabled: true,
      // Mode conformité : personne, même l'administrateur du compte, ne peut effacer avant 10 ans.
      objectLockDefaultRetention: s3.ObjectLockRetention.compliance(Duration.days(3650)),
    });

    this.leasesTable = new dynamodb.Table(this, 'Baux', {
      partitionKey: { name: 'lease', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.clinicalKey,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
