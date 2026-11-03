import { DatabaseSync } from 'node:sqlite';
import { createTranslator } from '@hygia/i18n';
import type { Change } from '@hygia/sync-core';
import type { LocaleSource } from '@hygia/view-models';
import { openLocalStore, type LocalStore } from '../src/offline/local-store';
import type { SqlDatabase, SqlValue } from '../src/offline/sql-database';
import type {
  ConflictChoice,
  ConnectivityMonitor,
  Scheduler,
  SyncRequest,
  SyncResponse,
  SyncTransport,
} from '../src/offline/sync-protocol';

/** Base SQLite en mémoire (node:sqlite) derrière le même port que `expo-sqlite`. */
export class MemorySqlDatabase implements SqlDatabase {
  private readonly db = new DatabaseSync(':memory:');

  exec(sql: string): Promise<void> {
    this.db.exec(sql);
    return Promise.resolve();
  }

  run(sql: string, params: readonly SqlValue[] = []): Promise<void> {
    this.db.prepare(sql).run(...params);
    return Promise.resolve();
  }

  all<T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    return Promise.resolve(this.db.prepare(sql).all(...params) as T[]);
  }
}

export const freshStore = (): Promise<LocalStore> => openLocalStore(new MemorySqlDatabase());

export const fr: LocaleSource = { locale: 'fr', t: createTranslator('fr') };

/** Serveur simulé : réponse programmable, requêtes conservées. */
export class FakeTransport implements SyncTransport {
  requests: SyncRequest[] = [];
  arbitrations: { id: string; choice: ConflictChoice }[] = [];
  failures = 0;
  respond: (request: SyncRequest) => Partial<SyncResponse> = (request) => ({
    merged: request.changes,
  });

  push(request: SyncRequest): Promise<SyncResponse> {
    this.requests.push(request);
    if (this.failures > 0) {
      this.failures -= 1;
      return Promise.reject(new Error('réseau coupé'));
    }
    return Promise.resolve({
      merged: [],
      remote: [],
      conflicts: [],
      duplicates: 0,
      clocks: {},
      ...this.respond(request),
    });
  }

  arbitrate(id: string, choice: ConflictChoice): Promise<void> {
    this.arbitrations.push({ id, choice });
    return Promise.resolve();
  }
}

/** Moniteur piloté à la main. */
export class FakeMonitor implements ConnectivityMonitor {
  private readonly listeners = new Set<(online: boolean) => void>();

  constructor(private online = true) {}

  isOnline(): boolean {
    return this.online;
  }

  subscribe(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  set(online: boolean): void {
    this.online = online;
    for (const listener of this.listeners) listener(online);
  }
}

/** Planificateur manuel : `advance` exécute les tâches échues. */
export class FakeScheduler implements Scheduler {
  delays: number[] = [];
  private tasks: { at: number; task: () => void; live: boolean }[] = [];
  private time = 0;

  after(delayMs: number, task: () => void): () => void {
    this.delays.push(delayMs);
    const entry = { at: this.time + delayMs, task, live: true };
    this.tasks.push(entry);
    return () => {
      entry.live = false;
    };
  }

  advance(ms: number): void {
    this.time += ms;
    for (const entry of this.tasks.filter((e) => e.live && e.at <= this.time)) {
      entry.live = false;
      entry.task();
    }
  }
}

/** Laisse les promesses en cours se résoudre. */
export const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

export const change = (over: Partial<Change> = {}): Change => ({
  key: 'tab:Dossier/p1:1',
  resourceId: 'Dossier/p1',
  patientId: 'p1',
  kind: 'add',
  field: 'observations',
  value: 'RAS',
  clock: { tab: 1 },
  nodeId: 'tab',
  at: '2026-11-03T08:20:00.000Z',
  ...over,
});
