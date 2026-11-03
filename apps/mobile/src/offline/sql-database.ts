/** Valeur liable à un paramètre SQL. */
export type SqlValue = string | number | null;

/**
 * Accès minimal à une base SQLite. En production : `expo-sqlite` ; dans les tests : `node:sqlite`
 * (même dialecte, aucun appareil requis).
 */
export interface SqlDatabase {
  /** Exécute un ou plusieurs ordres sans paramètre (schéma). */
  exec(sql: string): Promise<void>;
  /** Exécute un ordre paramétré (`?`). */
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;
  /** Lit des lignes. */
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
}

/** Schéma de la base locale : dossiers, journal des changements (file d'envoi), horloges, conflits, méta. */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY NOT NULL,
  family_name TEXT NOT NULL,
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS changes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  resource_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS changes_status ON changes (direction, status);
CREATE TABLE IF NOT EXISTS clocks (
  resource_id TEXT PRIMARY KEY NOT NULL,
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conflicts (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL,
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;
