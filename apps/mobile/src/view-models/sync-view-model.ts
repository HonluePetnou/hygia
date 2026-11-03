import type { Change } from '@hygia/sync-core';
import { makeAutoObservable, runInAction } from 'mobx';
import type { LocaleSource } from '@hygia/view-models';
import type { AutoSyncEvent } from '../offline/auto-sync.js';
import type { LocalStore } from '../offline/local-store.js';
import { LAST_REPORT_KEY, type SyncEngine, type SyncReport } from '../offline/sync-engine.js';
import type { ConflictChoice, SyncConflict } from '../offline/sync-protocol.js';

/** Version d'un champ en conflit, côte à côte avec l'autre. */
export interface ConflictSide {
  choice: 'local' | 'remote';
  author: string;
  time: string;
  value: string;
  /** « [tab: 19, srv: 40] ». */
  clock: string;
}

/** Conflit à arbitrer, prêt à afficher. */
export interface ConflictCard {
  id: string;
  /** « POSOLOGIE · Furosémide · Oumarou Bello ». */
  heading: string;
  sides: [ConflictSide, ConflictSide];
  chosen: 'local' | 'remote';
}

const defaultTime = (iso: string): string => {
  const date = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const display = (value: unknown): string => (typeof value === 'string' ? value : JSON.stringify(value));

/**
 * Écran « Synchro » : modifications fusionnées au dernier envoi, conflits à arbitrer (deux
 * versions côte à côte) et choix appliqué par le service Synchronisation (audité).
 */
export class SyncViewModel {
  report: SyncReport | null = null;
  conflicts: SyncConflict[] = [];
  pending = 0;
  syncing = false;
  retryInMs: number | null = null;
  private choices = new Map<string, 'local' | 'remote'>();
  private names = new Map<string, string>();

  constructor(
    private readonly store: LocalStore,
    private readonly engine: SyncEngine,
    private readonly syncNow: () => Promise<void>,
    private readonly i18n: LocaleSource,
    private readonly formatTime: (iso: string) => string = defaultTime,
  ) {
    makeAutoObservable<SyncViewModel, 'store' | 'engine' | 'syncNow' | 'i18n' | 'formatTime'>(
      this,
      { store: false, engine: false, syncNow: false, i18n: false, formatTime: false },
      { autoBind: true },
    );
  }

  /** Relit la base locale : dernier bilan, conflits ouverts, file d'envoi. */
  async refresh(): Promise<void> {
    const raw = await this.store.meta.get(LAST_REPORT_KEY);
    const conflicts = await this.store.conflicts.open();
    const pending = await this.store.changes.pendingCount();
    const names = new Map<string, string>();
    const ids = new Set([
      ...conflicts.map((c) => c.patientId),
      ...((raw === undefined ? [] : (JSON.parse(raw) as SyncReport).merged) as Change[]).map(
        (c) => c.patientId,
      ),
    ]);
    for (const id of ids) {
      const patient = await this.store.patients.get(id);
      if (patient !== undefined) names.set(id, `${patient.familyName} ${patient.givenName}`);
    }
    runInAction(() => {
      this.report = raw === undefined ? null : (JSON.parse(raw) as SyncReport);
      this.conflicts = conflicts;
      this.pending = pending;
      this.names = names;
    });
  }

  /** Reprise automatique : met l'écran à jour après chaque tentative. */
  handle(event: AutoSyncEvent): void {
    this.retryInMs = event.type === 'failure' ? event.retryInMs : null;
    void this.refresh();
  }

  /** « Synchroniser maintenant ». */
  async synchronise(): Promise<void> {
    this.syncing = true;
    try {
      await this.syncNow();
    } finally {
      runInAction(() => {
        this.syncing = false;
      });
    }
    await this.refresh();
  }

  choose(conflictId: string, choice: 'local' | 'remote'): void {
    this.choices.set(conflictId, choice);
  }

  /** « Appliquer ce choix » : arbitrage par le service, puis conflit fermé localement. */
  async apply(conflictId: string): Promise<void> {
    const conflict = this.conflicts.find((c) => c.id === conflictId);
    if (conflict === undefined) return;
    const choice: ConflictChoice = this.choices.get(conflictId) ?? 'remote';
    await this.engine.arbitrate(conflict, choice);
    this.choices.delete(conflictId);
    await this.refresh();
  }

  private name(patientId: string): string {
    return this.names.get(patientId) ?? patientId;
  }

  get subtitle(): string {
    return this.report === null
      ? this.i18n.t('mobile.sync.never')
      : this.i18n.t('mobile.sync.networkBack', { time: this.formatTime(this.report.at) });
  }

  get waitingLabel(): string {
    const { t } = this.i18n;
    return t(this.pending === 1 ? 'mobile.sync.waiting.one' : 'mobile.sync.waiting.other', {
      count: this.pending,
    });
  }

  get failureLabel(): string {
    return this.retryInMs === null
      ? ''
      : this.i18n.t('mobile.sync.failed', { seconds: Math.ceil(this.retryInMs / 1000) });
  }

  get mergedTitle(): string {
    const count = this.report?.merged.length ?? 0;
    return this.i18n.t(count === 1 ? 'mobile.sync.merged.one' : 'mobile.sync.merged.other', {
      count,
    });
  }

  /** Lignes « Constantes · Kaltouma Zara · 08:20 ». */
  get mergedRows(): string[] {
    const { t } = this.i18n;
    return (this.report?.merged ?? []).map((change) => {
      const label =
        change.field === 'vitals'
          ? t('mobile.sync.change.vitals')
          : change.field === 'observations'
            ? t('mobile.sync.change.observation')
            : t('mobile.sync.change.set');
      return `${label} · ${this.name(change.patientId)} · ${this.formatTime(change.at)}`;
    });
  }

  get conflictsTitle(): string {
    return this.i18n.t(
      this.conflicts.length === 1 ? 'mobile.sync.conflicts.one' : 'mobile.sync.conflicts.other',
      { count: this.conflicts.length },
    );
  }

  get conflictCards(): ConflictCard[] {
    const { t } = this.i18n;
    const side = (choice: 'local' | 'remote', change: Change): ConflictSide => ({
      choice,
      author: `${change.nodeId} · ${t(choice === 'local' ? 'mobile.sync.local' : 'mobile.sync.remote')}`,
      time: this.formatTime(change.at),
      value: display(change.value),
      clock: `[${Object.entries(change.clock)
        .map(([node, count]) => `${node}: ${count}`)
        .join(', ')}]`,
    });
    return this.conflicts.map((conflict) => {
      const field = Object.hasOwn(this.fieldLabels, conflict.field)
        ? t(this.fieldLabels[conflict.field] as string)
        : conflict.field;
      return {
        id: conflict.id,
        heading: `${field} · ${this.name(conflict.patientId)}`.toUpperCase(),
        sides: [side('local', conflict.local), side('remote', conflict.remote)],
        chosen: this.choices.get(conflict.id) ?? 'remote',
      };
    });
  }

  private readonly fieldLabels: Record<string, string> = { posologie: 'mobile.sync.field.posologie' };
}
