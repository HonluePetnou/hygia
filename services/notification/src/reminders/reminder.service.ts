import { Inject, Injectable } from '@nestjs/common';
import { ChannelRegistry } from '../channels/channel-registry.js';
import type { ChannelName } from '../channels/channel-sender.js';
import { MessageTemplates } from '../templates/message-templates.js';
import {
  APPOINTMENT_STORE,
  RECIPIENT_DIRECTORY,
  type Appointment,
  type AppointmentStore,
  type RecipientDirectory,
} from './appointments.js';

/** Horloge injectable. */
export const CLOCK = Symbol('CLOCK');
export type Clock = () => Date;

/** Ordre de préférence des canaux pour un rappel. */
export const REMINDER_CHANNELS: ChannelName[] = ['whatsapp', 'sms', 'email', 'console'];

/** Résultat de la planification. */
export interface ReminderRun {
  sent: string[];
  failed: string[];
}

/** Jour UTC (AAAA-MM-JJ) d'une date. */
function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Rappels de rendez-vous, la veille.
 *
 * Sémantique « au plus une fois » (cahier, section 7.3) : le rendez-vous est marqué rappelé
 * AVANT l'envoi. Si l'envoi échoue ou si le processus s'arrête entre les deux, le rappel n'est
 * pas rejoué : un rappel perdu est jugé moins grave qu'un rappel en double.
 */
@Injectable()
export class ReminderService {
  constructor(
    @Inject(APPOINTMENT_STORE) private readonly appointments: AppointmentStore,
    @Inject(RECIPIENT_DIRECTORY) private readonly directory: RecipientDirectory,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly channels: ChannelRegistry,
    private readonly templates: MessageTemplates,
  ) {}

  /** Envoie les rappels des rendez-vous prévus demain (UTC), non encore rappelés. */
  async runDue(): Promise<ReminderRun> {
    const now = this.clock();
    const tomorrow = utcDay(new Date(now.getTime() + 86_400_000));
    const run: ReminderRun = { sent: [], failed: [] };
    for (const appointment of this.appointments.all()) {
      if (appointment.remindedAt !== undefined) continue;
      if (appointment.status !== 'scheduled') continue;
      if (utcDay(new Date(appointment.startsAt)) !== tomorrow) continue;
      const delivered = await this.remind(appointment, now);
      (delivered ? run.sent : run.failed).push(appointment.id);
    }
    return run;
  }

  private async remind(appointment: Appointment, now: Date): Promise<boolean> {
    this.appointments.save({ ...appointment, remindedAt: now.toISOString() });
    const recipient = this.directory.byPatientId(appointment.patientId);
    if (recipient === undefined) return false;
    const text = this.templates.reminder(recipient.locale, appointment.startsAt);
    try {
      await this.channels.send({ recipient, text }, REMINDER_CHANNELS);
      return true;
    } catch {
      return false;
    }
  }
}
