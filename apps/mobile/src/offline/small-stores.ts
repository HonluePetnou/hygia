import type { ClockRecord } from '@hygia/sync-core';
import type { SqlDatabase } from './sql-database.js';
import type { SyncConflict } from './sync-protocol.js';

/** Horloge vectorielle connue de chaque ressource suivie. */
export class ClockStore {
  constructor(private readonly db: SqlDatabase) {}

  /** Horloge d'une ressource (vide si inconnue). */
  async get(resourceId: string): Promise<ClockRecord> {
    const rows = await this.db.all<{ json: string }>('SELECT json FROM clocks WHERE resource_id = ?', [
      resourceId,
    ]);
    return rows[0] === undefined ? {} : (JSON.parse(rows[0].json) as ClockRecord);
  }

  /** Remplace l'horloge d'une ressource. */
  async set(resourceId: string, clock: ClockRecord): Promise<void> {
    await this.db.run(
      'INSERT INTO clocks (resource_id, json) VALUES (?, ?) ON CONFLICT(resource_id) DO UPDATE SET json = excluded.json',
      [resourceId, JSON.stringify(clock)],
    );
  }

  /** Horloges de toutes les ressources suivies (envoyées au service avec chaque lot). */
  async all(): Promise<Record<string, ClockRecord>> {
    const rows = await this.db.all<{ resource_id: string; json: string }>(
      'SELECT resource_id, json FROM clocks',
    );
    return Object.fromEntries(rows.map((r) => [r.resource_id, JSON.parse(r.json) as ClockRecord]));
  }
}

/** Conflits reçus du service, à arbitrer par un soignant. */
export class ConflictStore {
  constructor(private readonly db: SqlDatabase) {}

  /** Enregistre un conflit (sans écraser un conflit déjà arbitré). */
  async save(conflict: SyncConflict): Promise<void> {
    await this.db.run('INSERT OR IGNORE INTO conflicts (id, status, json) VALUES (?, ?, ?)', [
      conflict.id,
      conflict.status,
      JSON.stringify(conflict),
    ]);
  }

  /** Conflits à arbitrer. */
  async open(): Promise<SyncConflict[]> {
    const rows = await this.db.all<{ json: string }>(
      "SELECT json FROM conflicts WHERE status = 'open' ORDER BY rowid",
    );
    return rows.map((r) => JSON.parse(r.json) as SyncConflict);
  }

  /** Marque un conflit comme arbitré. */
  async resolve(id: string): Promise<void> {
    await this.db.run("UPDATE conflicts SET status = 'resolved' WHERE id = ?", [id]);
  }
}

/** Petites valeurs de l'application (début de la coupure, dernière synchronisation…). */
export class MetaStore {
  constructor(private readonly db: SqlDatabase) {}

  async get(key: string): Promise<string | undefined> {
    const rows = await this.db.all<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
    return rows[0]?.value;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.run(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  }

  async delete(key: string): Promise<void> {
    await this.db.run('DELETE FROM meta WHERE key = ?', [key]);
  }
}
