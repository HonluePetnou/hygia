import type { Change, ClockRecord, Conflict } from '@hygia/sync-core';

/** Corps de `POST /sync` (service Synchronisation, via le broker). */
export interface SyncRequest {
  nodeId: string;
  changes: Change[];
  clocks: Record<string, ClockRecord>;
}

/** Conflit tel que le service le conserve : arbitré ou non. */
export interface SyncConflict extends Conflict {
  id: string;
  status: 'open' | 'resolved';
}

/** Réponse de `POST /sync`. */
export interface SyncResponse {
  merged: Change[];
  remote: Change[];
  conflicts: SyncConflict[];
  duplicates: number;
  clocks: Record<string, ClockRecord>;
}

/** Choix d'arbitrage d'un conflit. */
export type ConflictChoice = 'local' | 'remote' | 'manual';

/** Transport vers le service Synchronisation (HTTP en production, faux dans les tests). */
export interface SyncTransport {
  /** Envoie un lot ; rejette si le réseau ou le service est indisponible. */
  push(request: SyncRequest): Promise<SyncResponse>;
  /** Arbitre un conflit (`POST /sync/conflits/:id/arbitrage`, tracé dans l'audit). */
  arbitrate(conflictId: string, choice: ConflictChoice, value?: unknown): Promise<void>;
}

/** Surveille la connexion au broker. */
export interface ConnectivityMonitor {
  /** État courant. */
  isOnline(): boolean;
  /** Notifie chaque changement d'état ; renvoie la fonction de désabonnement. */
  subscribe(listener: (online: boolean) => void): () => void;
}

/** Planificateur de relances (minuteries injectables pour les tests). */
export interface Scheduler {
  /** Programme `task` dans `delayMs` ; renvoie l'annulation. */
  after(delayMs: number, task: () => void): () => void;
}
