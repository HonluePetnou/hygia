import { InMemoryAuditStore, type AuditEvent, type AuditStore } from '@hygia/audit';

/** Motifs codés par Dossiers, rendus lisibles pour le patient et le DPO. */
const REASON_LABELS: Readonly<Record<string, string>> = {
  soins: 'Soins',
  equipe: 'Soins',
  bris_de_glace: "Accès d'urgence (bris de glace)",
  droit_acces: 'Accès de la personne à son propre dossier',
};

export interface ForwardingAuditStoreOptions {
  /** URL du service Audit (`AUDIT_URL`). */
  url: string;
  /** Clé des écritures internes (`AUDIT_INTERNAL_KEY`). */
  key: string;
  /** Nom affichable d'un acteur (praticien, patient) ; `undefined` : l'identifiant est gardé. */
  resolveActor: (actorId: string) => string | undefined;
  fetchFn?: typeof fetch;
  warn?: (message: string) => void;
}

/**
 * Journal local chaîné (source de vérité de Dossiers, identifiants des acteurs) dont chaque entrée
 * est aussi transmise au service Audit (`POST /internal/events`), qui alimente le journal du DPO et
 * « Qui a vu mon dossier ? ». Envois dans l'ordre ; si Audit est injoignable, l'entrée attend et
 * repart avec la suivante : le journal local, lui, n'est jamais bloqué.
 */
export class ForwardingAuditStore implements AuditStore {
  private readonly local = new InMemoryAuditStore();
  private readonly outbox: AuditEvent[] = [];
  private sending: Promise<void> = Promise.resolve();
  private readonly fetchFn: typeof fetch;
  private readonly warn: (message: string) => void;

  constructor(private readonly options: ForwardingAuditStoreOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.warn = options.warn ?? ((message) => console.warn(message));
  }

  append(event: AuditEvent): void {
    this.local.append(event);
    this.outbox.push(event);
    this.sending = this.sending.then(() => this.drain());
  }

  all(): readonly AuditEvent[] {
    return this.local.all();
  }

  /** Attend la fin des envois en cours (tests, arrêt). */
  flush(): Promise<void> {
    return this.sending;
  }

  private async drain(): Promise<void> {
    while (this.outbox.length > 0) {
      const event = this.outbox[0] as AuditEvent;
      try {
        const response = await this.fetchFn(`${this.options.url}/internal/events`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-internal-key': this.options.key },
          body: JSON.stringify({
            actor: this.options.resolveActor(event.actor) ?? event.actor,
            role: event.role,
            action: event.action,
            resourceType: event.resourceType,
            resourceId: event.resourceId,
            patientId: event.patientId,
            reason: REASON_LABELS[event.reason] ?? event.reason,
          }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        this.warn(
          `Journal d'audit : transmission au service Audit en attente (${this.outbox.length} entrée(s)) : ${String(error)}`,
        );
        return;
      }
      this.outbox.shift();
    }
  }
}
