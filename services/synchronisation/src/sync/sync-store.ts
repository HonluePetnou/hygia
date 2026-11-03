import { createHash } from 'node:crypto';
import type { Change, Conflict } from '@hygia/sync-core';

/** Jeton d'injection du magasin de synchronisation. */
export const SYNC_STORE = Symbol('SYNC_STORE');

/** Identifiant stable d'un conflit : même champ, mêmes deux versions. */
export function conflictId(conflict: Conflict): string {
  const raw = JSON.stringify([
    conflict.resourceId,
    conflict.field,
    conflict.local.key,
    conflict.remote.key,
  ]);
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

/** Choix du soignant lors de l'arbitrage. */
export type ConflictChoice = 'local' | 'remote' | 'manual';

/** Conflit enregistré, en attente ou arbitré. */
export interface StoredConflict extends Conflict {
  id: string;
  status: 'open' | 'resolved';
  resolution?: {
    choice: ConflictChoice;
    value: unknown;
    by: string;
    at: string;
    changeKey: string;
  };
}

/**
 * Journal des changements retenus, clés d'idempotence vues et conflits.
 * Implémentation en mémoire (remplaçable par PostgreSQL, un dépôt par service).
 */
export class SyncStore {
  /** Changements retenus par le serveur (une version maximale par champ `set`). */
  log: Change[] = [];
  /** Clés d'idempotence déjà traitées. */
  readonly seen = new Set<string>();
  readonly conflicts = new Map<string, StoredConflict>();

  /** Changements retenus pour une ressource. */
  changesOf(resourceId: string): Change[] {
    return this.log.filter((c) => c.resourceId === resourceId);
  }
}
