/** Configuration validée du service. */
export interface Env {
  /** Port d'écoute HTTP (`IA_CLINIQUE_PORT`, défaut 3003). */
  port: number;
  /** URL du JWKS du service Identité (`IDENTITE_JWKS_URL`). */
  jwksUrl: string;
  /** URL du service Dossiers, qui détient les consentements (`DOSSIERS_URL`, défaut http://localhost:3001). */
  dossiersUrl: string;
  /** Clé des appels internes vers Dossiers (`DOSSIERS_INTERNAL_KEY`, valeur de démonstration par défaut). */
  internalKey: string;
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
  const dossiersUrl = source['DOSSIERS_URL'] || 'http://localhost:3001';
  if (!URL.canParse(dossiersUrl)) {
    throw new Error(`DOSSIERS_URL invalide : « ${dossiersUrl} » (URL absolue attendue)`);
  }
  const internalKey = source['DOSSIERS_INTERNAL_KEY'] || 'demo-dossiers-key';
  const raw = source['IA_CLINIQUE_PORT'];
  if (raw === undefined || raw === '') return { port: 3003, jwksUrl, dossiersUrl, internalKey };
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`IA_CLINIQUE_PORT invalide : « ${raw} » (entier entre 1 et 65535 attendu)`);
  }
  return { port, jwksUrl, dossiersUrl, internalKey };
}
