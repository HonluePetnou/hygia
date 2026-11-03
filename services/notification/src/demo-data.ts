import type { Recipient } from './channels/channel-sender.js';
import type { Appointment } from './reminders/appointments.js';

/** Patients fictifs de démonstration (numéros inventés). */
export const DEMO_RECIPIENTS: Recipient[] = [
  {
    patientId: '00000000-0000-4000-8000-010000000001',
    locale: 'fr',
    phone: '+237600000001',
    email: 'florence@example.invalid',
  },
  {
    patientId: '00000000-0000-4000-8000-010000000002',
    locale: 'en',
    phone: '+237600000002',
    email: 'patient.en@example.invalid',
  },
];

/** Rendez-vous de démonstration : demain à 09:00 UTC pour chaque patient. */
export function demoAppointments(now: Date): Appointment[] {
  const tomorrow = new Date(now.getTime() + 86_400_000);
  tomorrow.setUTCHours(9, 0, 0, 0);
  return DEMO_RECIPIENTS.map((r, index) => ({
    id: `00000000-0000-4000-8000-0a000000000${index + 1}`,
    patientId: r.patientId,
    startsAt: tomorrow.toISOString(),
    status: 'scheduled',
  }));
}
