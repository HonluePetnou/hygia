import type { AlertAgent, AlertSeverity } from './alert.js';

/** Jeton d'injection du diffuseur d'événements d'alerte. */
export const ALERT_EVENTS = Symbol('ALERT_EVENTS');

/** Événement `alerte.notification` consommé par le service Notification (prévenir le prescripteur). */
export interface AlertNotificationEvent {
  type: 'alerte.notification';
  alertId: string;
  patientId: string;
  agent: AlertAgent;
  severity: AlertSeverity;
  title: string;
  /** Soignant qui a décidé d'accepter et de notifier. */
  requestedBy: string;
  at: string;
}

/** Publie les événements d'alerte vers le bus (SQS en production). */
export interface AlertEventPublisher {
  publish(event: AlertNotificationEvent): void;
}

/** Diffuseur en mémoire : conserve les événements (tests, démo sans bus). */
export class InMemoryAlertEventPublisher implements AlertEventPublisher {
  readonly published: AlertNotificationEvent[] = [];

  publish(event: AlertNotificationEvent): void {
    this.published.push(event);
  }
}
