/** Jeton d'injection de `EventBus`. */
export const EVENT_BUS = Symbol('EVENT_BUS');

/** Événement publié sur le bus (SNS/SQS en production). */
export interface DomainEvent {
  type: 'bris_de_glace.ouvert';
  occurredAt: string;
  /** Destinataire de la notification (la DPO pour un bris de glace). */
  recipient: 'dpo';
  payload: Record<string, string>;
}

/** Bus d'événements. */
export interface EventBus {
  publish(event: DomainEvent): void;
}

/** Bus en mémoire : conserve les événements publiés (consultables par les tests et la démo). */
export class InMemoryEventBus implements EventBus {
  readonly published: DomainEvent[] = [];

  publish(event: DomainEvent): void {
    this.published.push(event);
  }
}
