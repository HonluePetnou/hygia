import { Inject, Injectable } from '@nestjs/common';
import { ChannelRegistry } from '../channels/channel-registry.js';
import { MessageTemplates } from '../templates/message-templates.js';
import {
  APPOINTMENT_STORE,
  RECIPIENT_DIRECTORY,
  type Appointment,
  type AppointmentStore,
  type RecipientDirectory,
} from './appointments.js';
import { REMINDER_CHANNELS } from './reminder.service.js';

/** Issue du traitement d'une réponse patient. */
export type ReplyOutcome = 'confirmed' | 'postponement_requested' | 'unknown_reply' | 'ignored';

/** Traite les réponses « 1 » (confirmer) et « 2 » (reporter) aux rappels. */
@Injectable()
export class ReplyService {
  constructor(
    @Inject(APPOINTMENT_STORE) private readonly appointments: AppointmentStore,
    @Inject(RECIPIENT_DIRECTORY) private readonly directory: RecipientDirectory,
    private readonly channels: ChannelRegistry,
    private readonly templates: MessageTemplates,
  ) {}

  /**
   * Traite un texte reçu d'un numéro.
   *
   * @returns `ignored` si le numéro est inconnu ou n'a aucun rappel en attente.
   */
  async handleText(phone: string, text: string): Promise<ReplyOutcome> {
    const recipient = this.directory.byPhone(phone);
    if (recipient === undefined) return 'ignored';
    const pending = this.pendingFor(recipient.patientId);
    if (pending === undefined) return 'ignored';
    const answer = text.trim();
    let outcome: ReplyOutcome = 'unknown_reply';
    let reply = this.templates.unknownReply(recipient.locale);
    if (answer === '1') {
      this.appointments.save({ ...pending, status: 'confirmed' });
      outcome = 'confirmed';
      reply = this.templates.confirmed(recipient.locale, pending.startsAt);
    } else if (answer === '2') {
      this.appointments.save({ ...pending, status: 'postponement_requested' });
      outcome = 'postponement_requested';
      reply = this.templates.postponed(recipient.locale, pending.startsAt);
    }
    await this.channels.send({ recipient, text: reply }, REMINDER_CHANNELS);
    return outcome;
  }

  /** Prochain rendez-vous rappelé et pas encore tranché. */
  private pendingFor(patientId: string): Appointment | undefined {
    return this.appointments
      .all()
      .filter((a) => a.patientId === patientId && a.status === 'scheduled' && a.remindedAt)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  }
}
