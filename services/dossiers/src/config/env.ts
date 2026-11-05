/** Configuration validée du service. */
export interface Env {
  /** Port d'écoute HTTP (`DOSSIERS_PORT`, défaut 3001). */
  port: number;
  /** URL du JWKS du service Identité (`IDENTITE_JWKS_URL`). */
  jwksUrl: string;
  /** Seuil de similarité des doublons, entre 0 et 1 (`DOSSIERS_SEUIL_DOUBLONS`, défaut 0,85). */
  duplicateThreshold: number;
  /** URL du service Agents, source du rapport épidémiologique (`AGENTS_URL`, défaut http://localhost:3007). */
  agentsUrl: string;
  /** Clé des appels internes des autres services (`DOSSIERS_INTERNAL_KEY`, valeur de démonstration par défaut). */
  internalKey: string;
  /**
   * Jour affiché par le tableau de bord, `AAAA-MM-JJ` (`DOSSIERS_DATE_DEMO`) : fixe la journée des
   * données fictives pendant la démonstration ; absent, c'est la date du jour.
   */
  dashboardDate?: string;
  /**
   * Transmission du journal au service Audit (`AUDIT_URL` + `AUDIT_INTERNAL_KEY`) ; absente, le
   * journal reste local à Dossiers (tests, mode isolé).
   */
  audit?: { url: string; key: string };
  /**
   * Versions des ressources sur S3 versionné (`DOSSIERS_S3_BUCKET`, `AWS_REGION`,
   * `AWS_ENDPOINT_URL` pour LocalStack) ; absent : en mémoire.
   */
  documentsS3?: { bucket: string; region: string; endpoint?: string };
  /**
   * Base PostgreSQL du service (`DOSSIERS_DATABASE_URL`) ; absente, les données restent en mémoire
   * (tests, mode hors ligne) et disparaissent à l'arrêt.
   */
  databaseUrl?: string;
}

const DEFAULT_AGENTS_URL = 'http://localhost:3007';
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
  const agentsUrl = source['AGENTS_URL'] || DEFAULT_AGENTS_URL;
  if (!URL.canParse(agentsUrl)) {
    throw new Error(`AGENTS_URL invalide : « ${agentsUrl} » (URL absolue attendue)`);
  }
  const internalKey = source['DOSSIERS_INTERNAL_KEY'] || 'demo-dossiers-key';
  const rawThreshold = source['DOSSIERS_SEUIL_DOUBLONS'];
  const duplicateThreshold =
    rawThreshold === undefined || rawThreshold === '' ? 0.85 : Number(rawThreshold);
  if (!(duplicateThreshold > 0 && duplicateThreshold <= 1)) {
    throw new Error(
      `DOSSIERS_SEUIL_DOUBLONS invalide : « ${rawThreshold} » (nombre dans ]0 ; 1] attendu)`,
    );
  }
  const dashboardDate = source['DOSSIERS_DATE_DEMO'] || undefined;
  if (dashboardDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(dashboardDate)) {
    throw new Error(`DOSSIERS_DATE_DEMO invalide : « ${dashboardDate} » (AAAA-MM-JJ attendu)`);
  }
  const auditUrl = source['AUDIT_URL'] || undefined;
  const auditKey = source['AUDIT_INTERNAL_KEY'] || undefined;
  if (auditUrl !== undefined && !URL.canParse(auditUrl)) {
    throw new Error(`AUDIT_URL invalide : « ${auditUrl} » (URL absolue attendue)`);
  }
  if (auditUrl !== undefined && auditKey === undefined) {
    throw new Error('AUDIT_URL fournie sans AUDIT_INTERNAL_KEY (clé des écritures internes)');
  }
  const databaseUrl = source['DOSSIERS_DATABASE_URL'] || undefined;
  if (databaseUrl !== undefined && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    throw new Error('DOSSIERS_DATABASE_URL invalide (URL postgresql:// attendue)');
  }
  const base = {
    ...(databaseUrl ? { databaseUrl } : {}),
    jwksUrl,
    duplicateThreshold,
    agentsUrl,
    internalKey,
    ...(dashboardDate ? { dashboardDate } : {}),
    ...(auditUrl && auditKey ? { audit: { url: auditUrl.replace(/\/$/, ''), key: auditKey } } : {}),
    ...(source['DOSSIERS_S3_BUCKET']
      ? {
          documentsS3: {
            bucket: source['DOSSIERS_S3_BUCKET'],
            region: source['AWS_REGION'] || 'eu-west-3',
            ...(source['AWS_ENDPOINT_URL'] ? { endpoint: source['AWS_ENDPOINT_URL'] } : {}),
          },
        }
      : {}),
  };
  const raw = source['DOSSIERS_PORT'];
  if (raw === undefined || raw === '') return { port: 3001, ...base };
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`DOSSIERS_PORT invalide : « ${raw} » (entier entre 1 et 65535 attendu)`);
  }
  return { port, ...base };
}
