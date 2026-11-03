/** Configuration validée du service. */
export interface Env {
  /** Port d'écoute HTTP (`DOSSIERS_PORT`, défaut 3001). */
  port: number;
  /** URL du JWKS du service Identité (`IDENTITE_JWKS_URL`). */
  jwksUrl: string;
  /** Seuil de similarité des doublons, entre 0 et 1 (`DOSSIERS_SEUIL_DOUBLONS`, défaut 0,85). */
  duplicateThreshold: number;
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
  const rawThreshold = source['DOSSIERS_SEUIL_DOUBLONS'];
  const duplicateThreshold = rawThreshold === undefined || rawThreshold === '' ? 0.85 : Number(rawThreshold);
  if (!(duplicateThreshold > 0 && duplicateThreshold <= 1)) {
    throw new Error(`DOSSIERS_SEUIL_DOUBLONS invalide : « ${rawThreshold} » (nombre dans ]0 ; 1] attendu)`);
  }
  const raw = source['DOSSIERS_PORT'];
  if (raw === undefined || raw === '') return { port: 3001, jwksUrl, duplicateThreshold };
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`DOSSIERS_PORT invalide : « ${raw} » (entier entre 1 et 65535 attendu)`);
  }
  return { port, jwksUrl, duplicateThreshold };
}
