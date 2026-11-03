/** Configuration validée au démarrage du service Audit. */
export interface AuditEnv {
  /** Port d'écoute (`AUDIT_PORT`, défaut 3005). */
  port: number;
  /** URL du JWKS du service Identité (`IDENTITE_JWKS_URL`). */
  jwksUrl: string;
  /** Secret des écritures internes (`AUDIT_INTERNAL_KEY`) ; absent : route interne fermée. */
  internalKey: string | undefined;
  /** Intervalle de contrôle de l'échéance quotidienne, en ms (`AUDIT_TICK_MS`, défaut 60000). */
  tickMs: number;
  /** Charge des entrées de démonstration (`AUDIT_SEED=0` pour désactiver). */
  seed: boolean;
}

type Source = Record<string, string | undefined>;

function integer(source: Source, key: string, fallback: number, max: number): number {
  const raw = source[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`${key} invalide : « ${raw} » (entier entre 1 et ${max} attendu)`);
  }
  return value;
}

/** Lit et valide les variables d'environnement ; lève `Error` si l'une est invalide. */
export function loadAuditEnv(source: Source = process.env): AuditEnv {
  const jwksUrl = source['IDENTITE_JWKS_URL'] || 'http://localhost:3004/.well-known/jwks.json';
  if (!URL.canParse(jwksUrl)) {
    throw new Error(`IDENTITE_JWKS_URL invalide : « ${jwksUrl} » (URL absolue attendue)`);
  }
  return {
    port: integer(source, 'AUDIT_PORT', 3005, 65535),
    jwksUrl,
    internalKey: source['AUDIT_INTERNAL_KEY'] || undefined,
    tickMs: integer(source, 'AUDIT_TICK_MS', 60_000, 86_400_000),
    seed: source['AUDIT_SEED'] !== '0',
  };
}
