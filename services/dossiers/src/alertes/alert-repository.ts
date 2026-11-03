import type { AlertRecord } from './alert.js';

/** Jeton d'injection du dépôt d'alertes. */
export const ALERT_REPOSITORY = Symbol('ALERT_REPOSITORY');

/** Stockage des alertes (en mémoire ici ; Prisma/PostgreSQL ensuite). */
export interface AlertRepository {
  all(): AlertRecord[];
  find(id: string): AlertRecord | undefined;
  /** Ajoute ou remplace l'alerte (même `id`). */
  save(alert: AlertRecord): void;
}

/** Dépôt en mémoire. */
export class InMemoryAlertRepository implements AlertRepository {
  private readonly alerts = new Map<string, AlertRecord>();

  constructor(initial: readonly AlertRecord[] = []) {
    initial.forEach((alert) => this.save(alert));
  }

  all(): AlertRecord[] {
    return [...this.alerts.values()].map((alert) => structuredClone(alert));
  }

  find(id: string): AlertRecord | undefined {
    const alert = this.alerts.get(id);
    return alert === undefined ? undefined : structuredClone(alert);
  }

  save(alert: AlertRecord): void {
    this.alerts.set(alert.id, structuredClone(alert));
  }
}
