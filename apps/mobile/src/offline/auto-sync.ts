import type { SyncReport, SyncEngine } from './sync-engine.js';
import type { ConnectivityMonitor, Scheduler } from './sync-protocol.js';

/** Événement émis par la reprise automatique. */
export type AutoSyncEvent =
  | { type: 'success'; report: SyncReport | null }
  | { type: 'failure'; retryInMs: number };

/**
 * Reprise automatique : dès que la connexion revient, la file est envoyée ; si l'envoi échoue
 * (réseau instable, service muet), nouvel essai avec un délai doublé à chaque échec (plafonné).
 * Hors connexion, aucune relance : le retour du réseau relance l'envoi.
 */
export class AutoSync {
  private unsubscribe: (() => void) | undefined;
  private cancelRetry: (() => void) | undefined;
  private failures = 0;

  constructor(
    private readonly engine: SyncEngine,
    private readonly monitor: ConnectivityMonitor,
    private readonly scheduler: Scheduler,
    private readonly onEvent: (event: AutoSyncEvent) => void = () => undefined,
    private readonly baseDelayMs = 2_000,
    private readonly maxDelayMs = 60_000,
  ) {}

  /** Commence à surveiller la connexion (et envoie tout de suite si elle est là). */
  start(): void {
    if (this.unsubscribe !== undefined) return;
    this.unsubscribe = this.monitor.subscribe((online) => {
      if (online) void this.attempt();
      else this.clearRetry();
    });
    if (this.monitor.isOnline()) void this.attempt();
  }

  /** Arrête la surveillance et annule la relance prévue. */
  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.clearRetry();
  }

  /** Envoi demandé par le soignant (« Synchroniser maintenant »). */
  async syncNow(): Promise<void> {
    this.clearRetry();
    await this.attempt();
  }

  private async attempt(): Promise<void> {
    this.clearRetry();
    try {
      const report = await this.engine.flush();
      this.failures = 0;
      this.onEvent({ type: 'success', report });
    } catch {
      const retryInMs = Math.min(this.baseDelayMs * 2 ** this.failures, this.maxDelayMs);
      this.failures += 1;
      this.onEvent({ type: 'failure', retryInMs });
      if (this.monitor.isOnline()) {
        this.cancelRetry = this.scheduler.after(retryInMs, () => void this.attempt());
      }
    }
  }

  private clearRetry(): void {
    this.cancelRetry?.();
    this.cancelRetry = undefined;
  }
}
