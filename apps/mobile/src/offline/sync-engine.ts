import { VectorClock, type Change } from '@hygia/sync-core';
import type { LocalStore } from './local-store.js';
import type { ConflictChoice, SyncConflict, SyncTransport } from './sync-protocol.js';

/** Bilan d'une synchronisation, conservé pour l'écran Synchro. */
export interface SyncReport {
  /** Instant de la synchronisation (ISO 8601). */
  at: string;
  /** Changements locaux fusionnés sans conflit. */
  merged: Change[];
  /** Changements du serveur reçus. */
  received: number;
  /** Changements déjà connus du service (rejeu). */
  duplicates: number;
}

/** Clé de `meta` où le dernier bilan est conservé. */
export const LAST_REPORT_KEY = 'lastReport';

/**
 * Vide la file d'envoi vers le service Synchronisation : un lot à la fois, dans l'ordre. Un
 * lot n'est marqué envoyé qu'une fois la réponse reçue ; en cas d'échec, tout reste en file
 * (livraison au moins une fois) et la clé d'idempotence évite tout doublon au rejeu.
 */
export class SyncEngine {
  private running: Promise<SyncReport | null> | undefined;

  constructor(
    private readonly store: LocalStore,
    private readonly transport: SyncTransport,
    private readonly nodeId: string,
    private readonly now: () => Date = () => new Date(),
    private readonly batchSize = 50,
  ) {}

  /**
   * Envoie tout ce qui est en attente. Deux appels simultanés partagent la même exécution.
   * Rejette si le service est injoignable (la file est alors intacte).
   *
   * @returns Le bilan cumulé, ou `null` s'il n'y avait rien à envoyer.
   */
  flush(): Promise<SyncReport | null> {
    this.running ??= this.drain().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  /** Applique le choix d'arbitrage d'un conflit via le service (audité), puis le ferme localement. */
  async arbitrate(conflict: SyncConflict, choice: ConflictChoice, value?: unknown): Promise<void> {
    await this.transport.arbitrate(conflict.id, choice, value);
    await this.store.conflicts.resolve(conflict.id);
  }

  private async drain(): Promise<SyncReport | null> {
    const total: SyncReport = { at: this.now().toISOString(), merged: [], received: 0, duplicates: 0 };
    let sent = 0;
    for (;;) {
      const queued = await this.store.changes.pending(this.batchSize);
      if (queued.length === 0) break;
      const keys = queued.map((q) => q.change.key);
      try {
        const response = await this.transport.push({
          nodeId: this.nodeId,
          changes: queued.map((q) => q.change),
          clocks: await this.store.clocks.all(),
        });
        await this.store.changes.markSent(keys);
        for (const change of response.remote) await this.store.changes.recordRemote(change);
        for (const conflict of response.conflicts) await this.store.conflicts.save(conflict);
        for (const [resourceId, clock] of Object.entries(response.clocks)) {
          const local = await this.store.clocks.get(resourceId);
          await this.store.clocks.set(
            resourceId,
            new VectorClock(local).merge(new VectorClock(clock)).toJSON(),
          );
        }
        total.merged.push(...response.merged);
        total.received += response.remote.length;
        total.duplicates += response.duplicates;
        sent += queued.length;
      } catch (error) {
        await this.store.changes.markFailed(keys);
        // Les lots déjà acquittés restent acquis : on garde leur bilan.
        if (sent > 0) await this.store.meta.set(LAST_REPORT_KEY, JSON.stringify(total));
        throw error;
      }
    }
    if (sent === 0) return null;
    await this.store.meta.set(LAST_REPORT_KEY, JSON.stringify(total));
    return total;
  }
}
