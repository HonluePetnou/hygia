import type { ConnectivityMonitor, Scheduler } from './sync-protocol.js';

/**
 * Surveille l'accès au broker par une sonde périodique (`probe` : `true` si joignable) et notifie
 * chaque changement d'état. Démarre « en ligne » tant que la première sonde n'a pas répondu.
 */
export class ReachabilityMonitor implements ConnectivityMonitor {
  private online = true;
  private running = false;
  private readonly listeners = new Set<(online: boolean) => void>();
  private cancel: (() => void) | undefined;

  constructor(
    private readonly probe: () => Promise<boolean>,
    private readonly scheduler: Scheduler,
    private readonly intervalMs = 5_000,
  ) {}

  isOnline(): boolean {
    return this.online;
  }

  subscribe(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Lance la sonde périodique. */
  start(): void {
    if (this.running) return;
    this.running = true;
    void this.tick();
  }

  /** Arrête la sonde. */
  stop(): void {
    this.running = false;
    this.cancel?.();
    this.cancel = undefined;
  }

  /** Force l'état (ex. réponse ou échec d'un envoi). */
  report(online: boolean): void {
    if (online === this.online) return;
    this.online = online;
    for (const listener of [...this.listeners]) listener(online);
  }

  private async tick(): Promise<void> {
    let reachable = false;
    try {
      reachable = await this.probe();
    } catch {
      reachable = false;
    }
    if (!this.running) return;
    this.report(reachable);
    this.cancel = this.scheduler.after(this.intervalMs, () => void this.tick());
  }
}
