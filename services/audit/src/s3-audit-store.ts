import type { AuditStore } from './audit-store.js';
import type { AuditEvent } from './types.js';

/**
 * Sous-ensemble des opérations S3 utilisées. Un adaptateur au-dessus de `@aws-sdk/client-s3`
 * (endpoint LocalStack) l'implémente. Le bucket doit être créé avec Object Lock activé.
 */
export interface S3ObjectLockOperations {
  /** `PutObject` avec `ObjectLockMode: COMPLIANCE` et une date de rétention (WORM). */
  putLocked(key: string, body: string, retainUntil: Date): Promise<void>;
  /** Clés du préfixe, triées. */
  list(prefix: string): Promise<string[]>;
  getObject(key: string): Promise<string>;
}

const PREFIX = 'audit/';
/** Rétention légale : 6 ans. */
export const RETENTION_YEARS = 6;

/** Clé d'objet d'une entrée : l'index est complété à 12 chiffres pour garder l'ordre lexicographique. */
export function eventKey(index: number): string {
  return `${PREFIX}${String(index).padStart(12, '0')}.json`;
}

/**
 * Journal sur S3 en mode WORM : un objet immuable par entrée (Object Lock, mode conformité).
 * `AuditStore` est synchrone : le magasin garde une copie en mémoire, chargée par `open()`, et
 * écrit chaque entrée en arrière-plan ; `flush()` attend que toutes les écritures soient faites.
 * Un objet verrouillé ne pouvant ni être modifié ni supprimé, une altération se voit à la relecture.
 */
export class S3ObjectLockAuditStore implements AuditStore {
  private readonly events: AuditEvent[] = [];
  private pending: Promise<void> = Promise.resolve();
  private failure: unknown;

  private constructor(
    private readonly s3: S3ObjectLockOperations,
    private readonly now: () => Date,
  ) {}

  /** Charge les entrées déjà présentes dans le bucket. */
  static async open(
    s3: S3ObjectLockOperations,
    now: () => Date = () => new Date(),
  ): Promise<S3ObjectLockAuditStore> {
    const store = new S3ObjectLockAuditStore(s3, now);
    for (const key of await s3.list(PREFIX)) {
      store.events.push(JSON.parse(await s3.getObject(key)) as AuditEvent);
    }
    return store;
  }

  append(event: AuditEvent): void {
    this.events.push(event);
    const retainUntil = this.now();
    retainUntil.setFullYear(retainUntil.getFullYear() + RETENTION_YEARS);
    this.pending = this.pending
      .then(() => this.s3.putLocked(eventKey(event.index), JSON.stringify(event), retainUntil))
      .catch((error: unknown) => {
        this.failure = error;
      });
  }

  all(): readonly AuditEvent[] {
    return this.events;
  }

  /** Attend la fin des écritures ; lève la première erreur d'écriture rencontrée. */
  async flush(): Promise<void> {
    await this.pending;
    if (this.failure !== undefined) throw this.failure;
  }
}
