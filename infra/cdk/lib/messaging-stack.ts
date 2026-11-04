import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import type * as kms from 'aws-cdk-lib/aws-kms';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';

export interface MessagingStackProps extends StackProps {
  clinicalKey: kms.IKey;
  analyticsKey: kms.IKey;
}

/**
 * Messages : bus EventBridge des événements métier, file SQS FIFO de l'ingestion (ordre par
 * patient, file de lettres mortes), sujet SNS des alertes, flux Kinesis de la branche analytique.
 * Tout est chiffré par KMS.
 */
export class MessagingStack extends Stack {
  readonly bus: events.EventBus;
  readonly ingestionQueue: sqs.Queue;
  readonly deadLetterQueue: sqs.Queue;
  readonly alertsTopic: sns.Topic;
  readonly analyticsStream: kinesis.Stream;

  constructor(scope: Construct, id: string, props: MessagingStackProps) {
    super(scope, id, props);

    this.bus = new events.EventBus(this, 'Bus', { eventBusName: 'hygia' });
    new events.Archive(this, 'ArchiveBus', {
      sourceEventBus: this.bus,
      eventPattern: { source: events.Match.prefix('hygia.') },
      retention: Duration.days(30),
    });

    this.deadLetterQueue = new sqs.Queue(this, 'LettresMortes', {
      fifo: true,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: props.clinicalKey,
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });
    this.ingestionQueue = new sqs.Queue(this, 'Ingestion', {
      fifo: true,
      contentBasedDeduplication: true,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: props.clinicalKey,
      visibilityTimeout: Duration.minutes(5),
      deadLetterQueue: { queue: this.deadLetterQueue, maxReceiveCount: 3 },
      enforceSSL: true,
    });

    this.alertsTopic = new sns.Topic(this, 'Alertes', {
      masterKey: props.clinicalKey,
      enforceSSL: true,
    });

    this.analyticsStream = new kinesis.Stream(this, 'FluxAnalytique', {
      encryption: kinesis.StreamEncryption.KMS,
      encryptionKey: props.analyticsKey,
      streamMode: kinesis.StreamMode.ON_DEMAND,
      retentionPeriod: Duration.hours(24),
    });
  }
}
