/** Configuration validée du service. */
export interface Env {
  /** Port d'écoute HTTP (`IA_CLINIQUE_PORT`, défaut 3003). */
  port: number;
}

/**
 * Valide les variables d'environnement au démarrage.
 *
 * @param source Variables à lire (par défaut `process.env`).
 * @throws Error si une variable est invalide.
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const raw = source['IA_CLINIQUE_PORT'];
  if (raw === undefined || raw === '') return { port: 3003 };
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`IA_CLINIQUE_PORT invalide : « ${raw} » (entier entre 1 et 65535 attendu)`);
  }
  return { port };
}
