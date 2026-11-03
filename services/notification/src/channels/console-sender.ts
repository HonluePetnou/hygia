import { randomUUID } from 'node:crypto';
import type { ChannelSender, DeliveryReceipt, OutboundMessage } from './channel-sender.js';

/** Canal de démonstration : écrit le message dans la console (ou un journal injecté). */
export class ConsoleSender implements ChannelSender {
  readonly channel = 'console' as const;
  readonly printed: string[] = [];

  constructor(private readonly log: (line: string) => void = (line) => console.log(line)) {}

  async send(message: OutboundMessage): Promise<DeliveryReceipt> {
    const line = `[notification] → ${message.recipient.patientId} : ${message.text}`;
    this.printed.push(line);
    this.log(line);
    return { channel: this.channel, messageId: randomUUID(), to: message.recipient.patientId };
  }
}
