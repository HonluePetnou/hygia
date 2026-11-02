import type { AuditEvent } from './types.js';

/** Stockage append-only du journal (production : S3 Object Lock). */
export interface AuditStore {
  append(event: AuditEvent): void;
  all(): readonly AuditEvent[];
}

/** Implémentation en mémoire, pour les tests et le développement local. */
export class InMemoryAuditStore implements AuditStore {
  private readonly events: AuditEvent[] = [];

  append(event: AuditEvent): void {
    this.events.push(event);
  }

  all(): readonly AuditEvent[] {
    return this.events;
  }
}
