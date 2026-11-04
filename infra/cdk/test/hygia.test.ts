import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildHygia } from '../lib/hygia-app.js';

let t: Record<'reseau' | 'donnees' | 'messages' | 'calcul' | 'acces' | 'observabilite', Template>;

beforeAll(() => {
  const stacks = buildHygia(new App(), { env: { account: '123456789012', region: 'eu-west-3' } });
  t = {
    reseau: Template.fromStack(stacks.network),
    donnees: Template.fromStack(stacks.data),
    messages: Template.fromStack(stacks.messaging),
    calcul: Template.fromStack(stacks.compute),
    acces: Template.fromStack(stacks.access),
    observabilite: Template.fromStack(stacks.observability),
  };
}, 120_000);

describe('architecture HYGIA (synthèse hors ligne)', () => {
  it("journal d'audit : S3 Object Lock en mode conformité", () => {
    t.donnees.hasResourceProperties('AWS::S3::Bucket', {
      ObjectLockEnabled: true,
      ObjectLockConfiguration: {
        ObjectLockEnabled: 'Enabled',
        Rule: { DefaultRetention: { Mode: 'COMPLIANCE', Days: 3650 } },
      },
    });
  });

  it('aucune base publique ; Aurora chiffrée par KMS, deux instances (Multi-AZ)', () => {
    const instances = t.donnees.findResources('AWS::RDS::DBInstance');
    expect(Object.keys(instances)).toHaveLength(2);
    for (const instance of Object.values(instances)) {
      expect(instance.Properties.PubliclyAccessible).toBe(false);
    }
    t.donnees.hasResourceProperties('AWS::RDS::DBCluster', {
      StorageEncrypted: true,
      KmsKeyId: Match.anyValue(),
    });
  });

  it('chiffrement KMS partout : S3, SQS, SNS, DynamoDB, Kinesis', () => {
    const buckets = t.donnees.findResources('AWS::S3::Bucket');
    expect(Object.keys(buckets).length).toBeGreaterThanOrEqual(4);
    for (const bucket of Object.values(buckets)) {
      const rule = bucket.Properties.BucketEncryption.ServerSideEncryptionConfiguration[0];
      expect(rule.ServerSideEncryptionByDefault.SSEAlgorithm).toBe('aws:kms');
    }
    const queues = t.messages.findResources('AWS::SQS::Queue');
    expect(Object.keys(queues)).toHaveLength(2);
    for (const queue of Object.values(queues)) expect(queue.Properties.KmsMasterKeyId).toBeDefined();
    t.messages.hasResourceProperties('AWS::SNS::Topic', { KmsMasterKeyId: Match.anyValue() });
    t.messages.hasResourceProperties('AWS::Kinesis::Stream', {
      StreamEncryption: { EncryptionType: 'KMS' },
    });
    t.donnees.hasResourceProperties('AWS::DynamoDB::Table', {
      SSESpecification: { SSEEnabled: true, SSEType: 'KMS' },
    });
  });

  it('table des baux identique à celle du code des agents (hygia-baux, clé pk, expiration expires_at)', () => {
    t.donnees.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'hygia-baux',
      KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }],
      TimeToLiveSpecification: { AttributeName: 'expires_at', Enabled: true },
    });
  });

  it('trois clés KMS distinctes (clinique, analytique, audit), rotation activée', () => {
    t.donnees.resourceCountIs('AWS::KMS::Key', 3);
    t.donnees.allResourcesProperties('AWS::KMS::Key', { EnableKeyRotation: true });
  });

  it('services Fargate : 2 tâches réparties sur 2 zones, sans IP publique', () => {
    const services = t.calcul.findResources('AWS::ECS::Service');
    expect(Object.keys(services)).toHaveLength(4);
    for (const service of Object.values(services)) {
      expect(service.Properties.DesiredCount).toBe(2);
      const network = service.Properties.NetworkConfiguration.AwsvpcConfiguration;
      expect(network.Subnets).toHaveLength(2);
      expect(network.AssignPublicIp).toBe('DISABLED');
    }
  });

  it("chaîne d'ingestion : Step Functions avec traces X-Ray ; Lambda tracées", () => {
    t.calcul.hasResourceProperties('AWS::StepFunctions::StateMachine', {
      TracingConfiguration: { Enabled: true },
    });
    t.calcul.resourceCountIs('AWS::Lambda::Function', 4);
    t.calcul.allResourcesProperties('AWS::Lambda::Function', { TracingConfig: { Mode: 'Active' } });
  });

  it("accès : API Gateway derrière WAF, Cognito avec double authentification", () => {
    t.acces.resourceCountIs('AWS::WAFv2::WebACLAssociation', 1);
    t.acces.hasResourceProperties('AWS::Cognito::UserPool', {
      MfaConfiguration: 'ON',
      EnabledMfas: ['SOFTWARE_TOKEN_MFA'],
    });
  });

  it('réseau : 2 zones, points de terminaison VPC (S3, DynamoDB, Bedrock…)', () => {
    t.reseau.resourceCountIs('AWS::EC2::VPCEndpoint', 11);
    const privateSubnets = Object.values(t.reseau.findResources('AWS::EC2::Subnet')).filter(
      (subnet) => JSON.stringify(subnet).includes('prive'),
    );
    expect(privateSubnets).toHaveLength(2);
  });

  it('résilience et coûts : expérience FIS, sauvegardes, budget plafonné', () => {
    t.observabilite.resourceCountIs('AWS::FIS::ExperimentTemplate', 1);
    t.observabilite.resourceCountIs('AWS::Backup::BackupPlan', 1);
    t.observabilite.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: Match.objectLike({ BudgetLimit: { Amount: 50, Unit: 'USD' } }),
    });
  });
});
