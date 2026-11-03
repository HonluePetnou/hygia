import { makeAutoObservable, runInAction } from 'mobx';
import type { MetaStore } from '../offline/small-stores.js';
import type { ConnectivityMonitor } from '../offline/sync-protocol.js';

const OFFLINE_SINCE_KEY = 'offlineSince';

/**
 * État de connexion observable. Le début de la coupure est conservé dans la base locale : il
 * survit à un redémarrage de l'application (« Hors ligne depuis 3 h 12 »).
 */
export class ConnectivityState {
  online = true;
  offlineSince: Date | null = null;

  constructor(
    private readonly monitor: ConnectivityMonitor,
    private readonly meta: MetaStore,
    private readonly now: () => Date = () => new Date(),
  ) {
    makeAutoObservable<ConnectivityState, 'monitor' | 'meta' | 'now'>(
      this,
      { monitor: false, meta: false, now: false },
      { autoBind: true },
    );
  }

  /** Charge la coupure en cours, puis suit le moniteur. Renvoie l'arrêt du suivi. */
  async start(): Promise<() => void> {
    const stored = await this.meta.get(OFFLINE_SINCE_KEY);
    const online = this.monitor.isOnline();
    runInAction(() => {
      this.online = online;
      this.offlineSince = online ? null : new Date(stored ?? this.now().toISOString());
    });
    if (online && stored !== undefined) await this.meta.delete(OFFLINE_SINCE_KEY);
    if (!online && stored === undefined) {
      await this.meta.set(OFFLINE_SINCE_KEY, this.now().toISOString());
    }
    return this.monitor.subscribe((value) => void this.change(value));
  }

  /** Durée de la coupure en minutes (0 si en ligne). */
  get offlineMinutes(): number {
    return this.offlineSince === null
      ? 0
      : Math.max(0, Math.floor((this.now().getTime() - this.offlineSince.getTime()) / 60_000));
  }

  private async change(online: boolean): Promise<void> {
    if (online) {
      runInAction(() => {
        this.online = true;
        this.offlineSince = null;
      });
      await this.meta.delete(OFFLINE_SINCE_KEY);
      return;
    }
    const since = (await this.meta.get(OFFLINE_SINCE_KEY)) ?? this.now().toISOString();
    await this.meta.set(OFFLINE_SINCE_KEY, since);
    runInAction(() => {
      this.online = false;
      this.offlineSince = new Date(since);
    });
  }
}
