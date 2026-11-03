import type { Recipient } from '../channels/channel-sender.js';

/** Jetons d'injection. */
export const RECIPIENT_DIRECTORY = Symbol('RECIPIENT_DIRECTORY');
export const APPOINTMENT_STORE = Symbol('APPOINTMENT_STORE');

/** Annuaire des coordonnées des patients. */
export interface RecipientDirectory {
  byPatientId(patientId: string): Recipient | undefined;
  byPhone(phone: string): Recipient | undefined;
}

/** Annuaire en mémoire (données fictives). */
export class InMemoryRecipientDirectory implements RecipientDirectory {
  constructor(private readonly recipients: readonly Recipient[]) {}

  byPatientId(patientId: string): Recipient | undefined {
    return this.recipients.find((r) => r.patientId === patientId);
  }

  byPhone(phone: string): Recipient | undefined {
    return this.recipients.find((r) => r.phone === phone);
  }
}

/** États d'un rendez-vous vis-à-vis du rappel. */
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'postponement_requested';

/** Rendez-vous à rappeler. */
export interface Appointment {
  id: string;
  patientId: string;
  /** Début, ISO 8601 (UTC). */
  startsAt: string;
  status: AppointmentStatus;
  /** Soignant, service et site affichés au patient (facultatifs). */
  clinician?: string;
  service?: string;
  site?: string;
  /** Renseigné quand le rappel a été émis (au plus une fois). */
  remindedAt?: string;
}

/** Dépôt des rendez-vous. */
export interface AppointmentStore {
  all(): Appointment[];
  get(id: string): Appointment | undefined;
  save(appointment: Appointment): void;
}

/** Dépôt en mémoire. */
export class InMemoryAppointmentStore implements AppointmentStore {
  private readonly items = new Map<string, Appointment>();

  constructor(initial: readonly Appointment[] = []) {
    for (const appointment of initial) this.items.set(appointment.id, { ...appointment });
  }

  all(): Appointment[] {
    return [...this.items.values()].map((a) => ({ ...a }));
  }

  get(id: string): Appointment | undefined {
    const found = this.items.get(id);
    return found && { ...found };
  }

  save(appointment: Appointment): void {
    this.items.set(appointment.id, { ...appointment });
  }
}
