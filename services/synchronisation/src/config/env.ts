/** Configuration validée du service. */
export interface Env {
  /** Port d'écoute HTTP (`SYNCHRONISATION_PORT`, défaut 3009). */
  port: number;
  /** URL du JWKS du service Identité (`IDENTITE_JWKS_URL`). */
  jwksUrl: string;
}

const DEFAULT_JWKS_URL = 'http://localhost:3004/.well-known/jwks.json';

/**
 * Valide les variables d'environnement au démarrage.
 *
 * @param source Variables à lire (par défaut `process.env`).
 * @throws Error si une variable est invalide.
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const jwksUrl = source['IDENTITE_JWKS_URL'] || DEFAULT_JWKS_URL;
  if (!URL.canParse(jwksUrl)) {
    throw new Error(`IDENTITE_JWKS_URL invalide : « ${jwksUrl} » (URL absolue attendue)`);
  }
  const rawPort = source['SYNCHRONISATION_PORT'];
  const port = rawPort === undefined || rawPort === '' ? 3009 : Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `SYNCHRONISATION_PORT invalide : « ${rawPort} » (entier entre 1 et 65535 attendu)`,
    );
  }
  return { port, jwksUrl };
}
