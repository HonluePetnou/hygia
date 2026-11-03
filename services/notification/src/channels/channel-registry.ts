import { Inject, Injectable } from '@nestjs/common';
import { CONSENT_GATE, type ConsentGate } from '../consent/consent-gate.js';
import {
  CHANNEL_SENDERS,
  type ChannelName,
  type ChannelSender,
  type DeliveryReceipt,
  type OutboundMessage,
} from './channel-sender.js';

/** Registre des canaux : choisit le canal préféré, repli sur le suivant si indisponible. */
@Injectable()
export class ChannelRegistry {
  private readonly byName = new Map<ChannelName, ChannelSender>();

  constructor(
    @Inject(CHANNEL_SENDERS) senders: ChannelSender[],
    @Inject(CONSENT_GATE) private readonly consent: ConsentGate,
  ) {
    for (const sender of senders) this.byName.set(sender.channel, sender);
  }

  /**
   * Envoie par le premier canal de `preference` qui accepte le message. WhatsApp est écarté si le
   * patient a refusé les rappels WhatsApp (consentement) : le message part alors par le canal suivant.
   *
   * @throws Error si aucun canal n'a pu envoyer le message.
   */
  async send(message: OutboundMessage, preference: ChannelName[]): Promise<DeliveryReceipt> {
    const failures: string[] = [];
    const whatsappAllowed =
      !preference.includes('whatsapp') ||
      (await this.consent.allows(message.recipient.patientId, 'whatsapp'));
    for (const name of preference) {
      if (name === 'whatsapp' && !whatsappAllowed) continue;
      const sender = this.byName.get(name);
      if (sender === undefined) continue;
      try {
        return await sender.send(message);
      } catch (error) {
        failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    throw new Error(`aucun canal disponible (${failures.join('; ') || 'aucun canal configuré'})`);
  }
}
