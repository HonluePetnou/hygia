import { Inject, Injectable } from '@nestjs/common';
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

  constructor(@Inject(CHANNEL_SENDERS) senders: ChannelSender[]) {
    for (const sender of senders) this.byName.set(sender.channel, sender);
  }

  /**
   * Envoie par le premier canal de `preference` qui accepte le message.
   *
   * @throws Error si aucun canal n'a pu envoyer le message.
   */
  async send(message: OutboundMessage, preference: ChannelName[]): Promise<DeliveryReceipt> {
    const failures: string[] = [];
    for (const name of preference) {
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
