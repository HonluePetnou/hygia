import { Inject, Injectable } from '@nestjs/common';
import { CriticalMessageService } from '../critical/critical-message.service.js';
import { NotificationInbox } from '../inbox/notification-inbox.js';
import { CLOCK, type Clock } from '../reminders/reminder.service.js';

/** Événements consommés (bus SQS en production, `POST /events` en local). */
export type NotificationEvent =
  | { type: 'alerte.notification'; alertId: string; patientId: string; title: string }
  | { type: 'alerte.creee'; alertId: string; title: string }
  | { type: 'analyse.terminee'; document: string }
  | { type: 'analyse.echouee'; document: string }
  | { type: 'resume.pret'; patient: string };

/** Types d'événements reconnus. */
export const EVENT_TYPES = [
  'alerte.notification',
  'alerte.creee',
  'analyse.terminee',
  'analyse.echouee',
  'resume.pret',
] as const;

/** Transforme les événements en messages patient (après validation) et en cloche. */
@Injectable()
export class EventsService {
  constructor(
    private readonly inbox: NotificationInbox,
    private readonly critical: CriticalMessageService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Traite un événement. */
  async handle(event: NotificationEvent): Promise<void> {
    const at = this.clock().toISOString();
    switch (event.type) {
      case 'alerte.notification':
        await this.critical.release(event.alertId);
        return;
      case 'alerte.creee':
        this.inbox.push('new_alert', 'notif.bell.newAlert', { title: event.title }, at);
        return;
      case 'analyse.terminee':
        this.inbox.push('analysis_done', 'notif.bell.analysisDone', { document: event.document }, at);
        return;
      case 'analyse.echouee':
        this.inbox.push('analysis_failed', 'notif.bell.analysisFailed', { document: event.document }, at);
        return;
      case 'resume.pret':
        this.inbox.push('summary_ready', 'notif.bell.summaryReady', { patient: event.patient }, at);
        return;
    }
  }
}
