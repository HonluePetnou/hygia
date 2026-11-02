/** Configuration validée du service. */
export interface Env {
  /** Port d'écoute HTTP (`DOSSIERS_PORT`, défaut 3001). */
  port: number;
}

/**
 * Valide les variables d'environnement au démarrage.
 *
 * @param source Variables à lire (par défaut `process.env`).
 * @throws Error si une variable est invalide.
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const raw = source['DOSSIERS_PORT'];
  if (raw === undefined || raw === '') return { port: 3001 };
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`DOSSIERS_PORT invalide : « ${raw} » (entier entre 1 et 65535 attendu)`);
  }
  return { port };
}
