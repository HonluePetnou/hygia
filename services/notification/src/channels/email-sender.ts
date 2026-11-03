import { randomUUID } from 'node:crypto';
import type { ChannelSender, DeliveryReceipt, OutboundMessage } from './channel-sender.js';

/** Courriel à transmettre. */
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** Transport d'e-mail (SES ou SMTP en production). */
export interface EmailTransport {
  sendMail(mail: Mail): Promise<{ id: string }>;
}

/** Transport en mémoire. */
export class InMemoryEmailTransport implements EmailTransport {
  readonly sent: Mail[] = [];

  async sendMail(mail: Mail): Promise<{ id: string }> {
    this.sent.push(mail);
    return { id: randomUUID() };
  }
}

/** Canal e-mail : nécessite une adresse. */
export class EmailSender implements ChannelSender {
  readonly channel = 'email' as const;

  constructor(private readonly transport: EmailTransport) {}

  async send(message: OutboundMessage): Promise<DeliveryReceipt> {
    const to = message.recipient.email;
    if (to === undefined) throw new Error('adresse e-mail manquante');
    const { id } = await this.transport.sendMail({
      to,
      subject: message.subject ?? 'HYGIA',
      text: message.text,
    });
    return { channel: this.channel, messageId: id, to };
  }
}
