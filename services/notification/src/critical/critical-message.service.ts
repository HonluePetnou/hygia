import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ChannelRegistry } from '../channels/channel-registry.js';
import type { ChannelName } from '../channels/channel-sender.js';
import { RECIPIENT_DIRECTORY, type RecipientDirectory } from '../reminders/appointments.js';
import { REMINDER_CHANNELS } from '../reminders/reminder.service.js';
import { MessageTemplates } from '../templates/message-templates.js';

/** Statut d'un message soignant → patient. */
export type MessageStatus = 'sent' | 'blocked' | 'failed';

/** Message en attente de validation d'une alerte critique. */
interface HeldMessage {
  id: string;
  patientId: string;
  text: string;
  channels: ChannelName[];
}

/** Résultat d'une demande d'envoi. */
export interface SendResult {
  id: string;
  status: MessageStatus;
}

/**
 * Messages du soignant vers le patient. Un message lié à une alerte critique (`alertId`) reste
 * bloqué tant qu'un soignant n'a pas validé l'alerte (événement `alerte.notification`, tâche 018).
 */
@Injectable()
export class CriticalMessageService {
  private readonly held = new Map<string, HeldMessage[]>();
  private readonly validated = new Set<string>();

  constructor(
    @Inject(RECIPIENT_DIRECTORY) private readonly directory: RecipientDirectory,
    private readonly channels: ChannelRegistry,
    private readonly templates: MessageTemplates,
  ) {}

  /** Envoie le message, ou le retient s'il dépend d'une alerte non validée. */
  async submit(
    patientId: string,
    text: string,
    alertId?: string,
    channels: ChannelName[] = REMINDER_CHANNELS,
  ): Promise<SendResult> {
    const message: HeldMessage = { id: randomUUID(), patientId, text, channels };
    if (alertId !== undefined && !this.validated.has(alertId)) {
      this.held.set(alertId, [...(this.held.get(alertId) ?? []), message]);
      return { id: message.id, status: 'blocked' };
    }
    return { id: message.id, status: await this.deliver(message) };
  }

  /** Une alerte a été validée par un soignant : libère ses messages retenus. */
  async release(alertId: string): Promise<SendResult[]> {
    this.validated.add(alertId);
    const pending = this.held.get(alertId) ?? [];
    this.held.delete(alertId);
    const results: SendResult[] = [];
    for (const message of pending) {
      results.push({ id: message.id, status: await this.deliver(message) });
    }
    return results;
  }

  /** Nombre de messages retenus pour une alerte. */
  heldCount(alertId: string): number {
    return this.held.get(alertId)?.length ?? 0;
  }

  private async deliver(message: HeldMessage): Promise<MessageStatus> {
    const recipient = this.directory.byPatientId(message.patientId);
    if (recipient === undefined) return 'failed';
    const text = this.templates.clinicianMessage(recipient.locale, message.text);
    try {
      await this.channels.send({ recipient, text }, message.channels);
      return 'sent';
    } catch {
      return 'failed';
    }
  }
}
