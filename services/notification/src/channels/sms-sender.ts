import { randomUUID } from 'node:crypto';
import type { ChannelSender, DeliveryReceipt, OutboundMessage } from './channel-sender.js';

/** Publication SNS directe vers un numéro (`Publish` avec `PhoneNumber`). */
export interface SnsPublisher {
  publishSms(phoneNumber: string, message: string): Promise<{ messageId: string }>;
}

/** Faux SNS en mémoire (tests, démo sans LocalStack). */
export class InMemorySnsPublisher implements SnsPublisher {
  readonly published: { phoneNumber: string; message: string }[] = [];

  async publishSms(phoneNumber: string, message: string): Promise<{ messageId: string }> {
    this.published.push({ phoneNumber, message });
    return { messageId: randomUUID() };
  }
}

/** Canal SMS via SNS (LocalStack en local). */
export class SmsSender implements ChannelSender {
  readonly channel = 'sms' as const;

  constructor(private readonly sns: SnsPublisher) {}

  async send(message: OutboundMessage): Promise<DeliveryReceipt> {
    const to = message.recipient.phone;
    if (to === undefined) throw new Error('numéro de téléphone manquant');
    const { messageId } = await this.sns.publishSms(to, message.text);
    return { channel: this.channel, messageId, to };
  }
}
