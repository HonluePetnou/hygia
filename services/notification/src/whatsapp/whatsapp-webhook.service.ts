import { Inject, Injectable } from '@nestjs/common';
import type { IngestionOutcome, RawDocument } from '@hygia/ingestion';
import { ChannelRegistry } from '../channels/channel-registry.js';
import { CLOCK, type Clock, REMINDER_CHANNELS } from '../reminders/reminder.service.js';
import { RECIPIENT_DIRECTORY, type RecipientDirectory } from '../reminders/appointments.js';
import { ReplyService, type ReplyOutcome } from '../reminders/reply.service.js';
import { NotificationInbox } from '../inbox/notification-inbox.js';
import { MessageTemplates } from '../templates/message-templates.js';

/** Jeton d'injection de la chaîne d'ingestion (tâche 005). */
export const DOCUMENT_INGESTOR = Symbol('DOCUMENT_INGESTOR');

/** Ce dont le webhook a besoin de la chaîne d'ingestion (`IngestionService` la satisfait). */
export interface DocumentIngestor {
  ingest(document: RawDocument): Promise<IngestionOutcome>;
}

/** Message entrant WhatsApp (forme simplifiée du webhook Cloud API). */
export interface InboundWhatsAppMessage {
  /** Numéro de l'expéditeur. */
  from: string;
  type: 'text' | 'image';
  text?: string;
  image?: { fileName?: string; base64: string };
}

/** Issue du traitement d'un message entrant. */
export type WebhookOutcome = ReplyOutcome | 'document_ingested' | 'document_rejected';

/** Traite les messages entrants : réponses « 1 » / « 2 » et photos envoyées à l'ingestion. */
@Injectable()
export class WhatsAppWebhookService {
  constructor(
    @Inject(DOCUMENT_INGESTOR) private readonly ingestor: DocumentIngestor,
    @Inject(RECIPIENT_DIRECTORY) private readonly directory: RecipientDirectory,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly replies: ReplyService,
    private readonly channels: ChannelRegistry,
    private readonly templates: MessageTemplates,
    private readonly inbox: NotificationInbox,
  ) {}

  /** Aiguille le message selon son type. */
  async handle(message: InboundWhatsAppMessage): Promise<WebhookOutcome> {
    if (message.type === 'text') return this.replies.handleText(message.from, message.text ?? '');
    return this.handleImage(message);
  }

  private async handleImage(message: InboundWhatsAppMessage): Promise<WebhookOutcome> {
    const recipient = this.directory.byPhone(message.from);
    if (recipient === undefined || message.image === undefined) return 'ignored';
    const document: RawDocument = {
      fileName: message.image.fileName ?? 'photo-whatsapp.jpg',
      bytes: Buffer.from(message.image.base64, 'base64'),
      subject: { reference: `Patient/${recipient.patientId}` },
      channel: 'WhatsApp',
    };
    const outcome = await this.ingestor.ingest(document);
    const accepted = outcome.status !== 'failed';
    const text = accepted
      ? this.templates.documentReceived(recipient.locale)
      : this.templates.documentRejected(recipient.locale);
    await this.channels.send({ recipient, text }, REMINDER_CHANNELS);
    const at = this.clock().toISOString();
    if (outcome.status === 'ok') {
      this.inbox.push('analysis_done', 'notif.bell.analysisDone', { document: document.fileName }, at);
    } else if (outcome.status === 'failed') {
      this.inbox.push('analysis_failed', 'notif.bell.analysisFailed', { document: document.fileName }, at);
    }
    return accepted ? 'document_ingested' : 'document_rejected';
  }
}
