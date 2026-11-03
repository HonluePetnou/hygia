import type { PatientSummary } from '@hygia/view-models';
import type { SqlDatabase } from './sql-database.js';

/** Dossier conservé sur l'appareil : fiche patient et contexte affiché sur la carte. */
export interface PatientRecord extends PatientSummary {
  /** Pathologie ou situation (ex. « Diabète type 2 »). */
  condition?: string;
  /** Motif du jour (ex. « Glycémie à contrôler »). */
  reason?: string;
}

const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Dossiers patients stockés dans SQLite. */
export class PatientStore {
  constructor(private readonly db: SqlDatabase) {}

  /** Ajoute ou remplace un dossier (les informations de contexte déjà connues sont conservées). */
  async upsert(record: PatientRecord): Promise<void> {
    const known = await this.get(record.id);
    const merged: PatientRecord = { ...known, ...record };
    await this.db.run(
      'INSERT INTO patients (id, family_name, json) VALUES (?, ?, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET family_name = excluded.family_name, json = excluded.json',
      [merged.id, merged.familyName, JSON.stringify(merged)],
    );
  }

  /** Un dossier, ou `undefined`. */
  async get(id: string): Promise<PatientRecord | undefined> {
    const rows = await this.db.all<{ json: string }>('SELECT json FROM patients WHERE id = ?', [id]);
    return rows[0] === undefined ? undefined : (JSON.parse(rows[0].json) as PatientRecord);
  }

  /** Dossiers dont le nom ou l'IPP contient la requête (accents et casse ignorés), par nom. */
  async search(query: string): Promise<PatientRecord[]> {
    const rows = await this.db.all<{ json: string }>(
      'SELECT json FROM patients ORDER BY family_name COLLATE NOCASE, id',
    );
    const needle = fold(query.trim());
    return rows
      .map((row) => JSON.parse(row.json) as PatientRecord)
      .filter(
        (p) =>
          needle === '' || fold(`${p.givenName} ${p.familyName} ${p.ipp}`).includes(needle),
      );
  }

  /** Nombre de dossiers locaux. */
  async count(): Promise<number> {
    const rows = await this.db.all<{ n: number }>('SELECT COUNT(*) AS n FROM patients');
    return rows[0]?.n ?? 0;
  }
}
