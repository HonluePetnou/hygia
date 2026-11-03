import { randomUUID } from 'node:crypto';
import type { ChannelSender, DeliveryReceipt, OutboundMessage } from './channel-sender.js';

/** API WhatsApp Business (bac à sable en local, Lambda + API Meta en production). */
export interface WhatsAppApi {
  sendText(to: string, body: string): Promise<{ id: string }>;
}

/** Bac à sable en mémoire : conserve les messages « envoyés ». */
export class SandboxWhatsAppApi implements WhatsAppApi {
  readonly sent: { to: string; body: string }[] = [];

  async sendText(to: string, body: string): Promise<{ id: string }> {
    this.sent.push({ to, body });
    return { id: `wamid.${randomUUID()}` };
  }
}

/** Canal WhatsApp : nécessite un numéro de téléphone. */
export class WhatsAppSender implements ChannelSender {
  readonly channel = 'whatsapp' as const;

  constructor(private readonly api: WhatsAppApi) {}

  async send(message: OutboundMessage): Promise<DeliveryReceipt> {
    const to = message.recipient.phone;
    if (to === undefined) throw new Error('numéro WhatsApp manquant');
    const { id } = await this.api.sendText(to, message.text);
    return { channel: this.channel, messageId: id, to };
  }
}
