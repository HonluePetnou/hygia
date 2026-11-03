/** Noms des services joignables par le broker (équivalent local de Cloud Map). */
export const SERVICE_NAMES = [
  'dossiers',
  'ia-clinique',
  'audit',
  'ingestion',
  'notification',
  'synchronisation',
  'identite',
  'agents',
] as const;

/** Zone de disponibilité : `a` = eu-west-3a, `b` = eu-west-3b. */
export type Zone = 'a' | 'b';

/** Instance d'un service, étiquetée par sa zone. */
export interface ServiceInstance {
  /** Identifiant stable, ex. `dossiers-a`. */
  id: string;
  service: string;
  zone: Zone;
  url: URL;
}

/** Configuration validée du broker. */
export interface Env {
  /** Port d'écoute (`BROKER_PORT`, défaut 3000). */
  port: number;
  /**
   * Adresses de chaque service déclaré (`BROKER_SERVICE_<NOM>_URL`) : une URL, ou plusieurs
   * séparées par des virgules, chacune éventuellement préfixée de sa zone (`a=http://…,b=http://…`).
   */
  services: Record<string, string>;
  /** Délai maximal avant la réponse du service, en ms (`BROKER_TIMEOUT_MS`, défaut 5000). */
  timeoutMs: number;
  /** Requêtes autorisées par utilisateur et par fenêtre (`BROKER_RATE_LIMIT`, défaut 300). */
  rateLimit: number;
  /** Durée de la fenêtre de limitation, en ms (`BROKER_RATE_WINDOW_MS`, défaut 60000). */
  rateWindowMs: number;
  /** URL du JWKS du service Identité (`BROKER_JWKS_URL`, sinon déduite de `identite`). */
  jwksUrl: string;
  /** Échecs consécutifs avant ouverture du disjoncteur (`BROKER_BREAKER_THRESHOLD`, défaut 3). */
  breakerThreshold: number;
  /** Durée d'ouverture du disjoncteur avant un nouvel essai, en ms (`BROKER_BREAKER_COOLDOWN_MS`, défaut 5000). */
  breakerCooldownMs: number;
  /** Origine web autorisée par CORS (`WEB_ORIGIN`). */
  webOrigin: string;
}

type Source = Record<string, string | undefined>;

function integer(source: Source, key: string, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const raw = source[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`${key} invalide : « ${raw} » (entier entre 1 et ${max} attendu)`);
  }
  return value;
}

/** Nom de variable d'un service : `ia-clinique` → `BROKER_SERVICE_IA_CLINIQUE_URL`. */
export function serviceEnvKey(name: string): string {
  return `BROKER_SERVICE_${name.toUpperCase().replace(/-/g, '_')}_URL`;
}

/**
 * Décode la valeur d'un service : `url`, `url,url` ou `zone=url,zone=url`. Sans étiquette, la
 * première instance est en zone a, la seconde en zone b.
 *
 * @throws Error si une URL est invalide.
 */
export function parseInstances(service: string, raw: string): ServiceInstance[] {
  const zones: Zone[] = ['a', 'b'];
  return raw.split(',').map((entry, position) => {
    const labelled = /^([ab])=(.+)$/.exec(entry.trim());
    const zone = (labelled?.[1] as Zone | undefined) ?? zones[position % 2] ?? 'a';
    const address = labelled?.[2] ?? entry.trim();
    if (!URL.canParse(address)) {
      throw new Error(`${serviceEnvKey(service)} invalide : « ${address} » (URL absolue attendue)`);
    }
    return { id: `${service}-${zone}${position >= 2 ? position : ''}`, service, zone, url: new URL(address) };
  });
}

/**
 * Valide les variables d'environnement au démarrage.
 *
 * @param source Variables à lire (par défaut `process.env`).
 * @throws Error si une variable est invalide.
 */
export function loadEnv(source: Source = process.env): Env {
  const services: Record<string, string> = {};
  for (const name of SERVICE_NAMES) {
    const key = serviceEnvKey(name);
    const raw = source[key];
    if (raw === undefined || raw === '') continue;
    parseInstances(name, raw);
    services[name] = raw;
  }
  const identite = services['identite']?.split(',')[0]?.replace(/^[ab]=/, '');
  const jwksUrl = source['BROKER_JWKS_URL'] || `${(identite ?? 'http://localhost:3004').replace(/\/+$/, '')}/.well-known/jwks.json`;
  if (!URL.canParse(jwksUrl)) throw new Error(`BROKER_JWKS_URL invalide : « ${jwksUrl} » (URL absolue attendue)`);
  return {
    jwksUrl,
    port: integer(source, 'BROKER_PORT', 3000, 65535),
    services,
    timeoutMs: integer(source, 'BROKER_TIMEOUT_MS', 5000),
    rateLimit: integer(source, 'BROKER_RATE_LIMIT', 300),
    rateWindowMs: integer(source, 'BROKER_RATE_WINDOW_MS', 60000),
    breakerThreshold: integer(source, 'BROKER_BREAKER_THRESHOLD', 3),
    breakerCooldownMs: integer(source, 'BROKER_BREAKER_COOLDOWN_MS', 5000),
    webOrigin: source['WEB_ORIGIN'] || 'http://localhost:3100',
  };
}
