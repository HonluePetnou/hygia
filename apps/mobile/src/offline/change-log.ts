import type { Change } from '@hygia/sync-core';
import type { SqlDatabase } from './sql-database.js';

/** Changement en file avec son nombre de tentatives d'envoi. */
export interface QueuedChange {
  change: Change;
  attempts: number;
}

interface Row {
  json: string;
  attempts: number;
}

/**
 * Journal des changements et file d'envoi persistante (section 6.3) : un changement reste
 * `pending` tant que le service ne l'a pas reçu ; il survit à un redémarrage de l'application.
 * La clé du changement est la clé d'idempotence : l'insérer deux fois n'ajoute rien.
 */
export class ChangeLog {
  constructor(private readonly db: SqlDatabase) {}

  /** Met un changement local en file d'envoi (ignoré si sa clé existe déjà). */
  async enqueue(change: Change): Promise<void> {
    await this.insert(change, 'local', 'pending');
  }

  /** Conserve un changement reçu du serveur (déjà connu de lui, jamais renvoyé). */
  async recordRemote(change: Change): Promise<void> {
    await this.insert(change, 'remote', 'sent');
  }

  /** Changements à envoyer, du plus ancien au plus récent, au plus `limit`. */
  async pending(limit = 50): Promise<QueuedChange[]> {
    const rows = await this.db.all<Row>(
      "SELECT json, attempts FROM changes WHERE direction = 'local' AND status = 'pending' ORDER BY seq LIMIT ?",
      [limit],
    );
    return rows.map((r) => ({ change: JSON.parse(r.json) as Change, attempts: r.attempts }));
  }

  /** Nombre de changements en attente d'envoi (d'un patient, ou tous). */
  async pendingCount(patientId?: string): Promise<number> {
    const rows =
      patientId === undefined
        ? await this.db.all<{ n: number }>(
            "SELECT COUNT(*) AS n FROM changes WHERE direction = 'local' AND status = 'pending'",
          )
        : await this.db.all<{ n: number }>(
            "SELECT COUNT(*) AS n FROM changes WHERE direction = 'local' AND status = 'pending' AND patient_id = ?",
            [patientId],
          );
    return rows[0]?.n ?? 0;
  }

  /** Marque des changements comme reçus par le service (fusionnés ou en conflit). */
  async markSent(keys: readonly string[]): Promise<void> {
    for (const key of keys) {
      await this.db.run("UPDATE changes SET status = 'sent' WHERE key = ? AND direction = 'local'", [
        key,
      ]);
    }
  }

  /** Compte une tentative d'envoi échouée pour ces changements. */
  async markFailed(keys: readonly string[]): Promise<void> {
    for (const key of keys) {
      await this.db.run('UPDATE changes SET attempts = attempts + 1 WHERE key = ?', [key]);
    }
  }

  /** Changements d'un patient, du plus ancien au plus récent (locaux et reçus). */
  async ofPatient(patientId: string): Promise<Change[]> {
    const rows = await this.db.all<Row>('SELECT json, attempts FROM changes WHERE patient_id = ? ORDER BY seq', [
      patientId,
    ]);
    return rows.map((r) => JSON.parse(r.json) as Change);
  }

  private async insert(change: Change, direction: 'local' | 'remote', status: string): Promise<void> {
    await this.db.run(
      'INSERT OR IGNORE INTO changes (key, resource_id, patient_id, direction, status, json) VALUES (?, ?, ?, ?, ?, ?)',
      [change.key, change.resourceId, change.patientId, direction, status, JSON.stringify(change)],
    );
  }
}
