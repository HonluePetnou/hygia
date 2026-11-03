/** Configuration lue au démarrage (variables `EXPO_PUBLIC_*`, validées ici). */
export interface MobileConfig {
  /** Adresse du broker, seul point d'entrée vers les services. */
  apiUrl: string;
  /** Jeton d'accès du service Identité (démo : fourni par l'environnement). */
  accessToken: string | undefined;
  /** Nom de la base SQLite de l'appareil. */
  databaseName: string;
  /** Intervalle de la sonde de connexion, en ms. */
  probeIntervalMs: number;
}

/** Variables d'environnement acceptées. */
export interface MobileEnv {
  EXPO_PUBLIC_API_URL?: string | undefined;
  EXPO_PUBLIC_ACCESS_TOKEN?: string | undefined;
  EXPO_PUBLIC_PROBE_INTERVAL_MS?: string | undefined;
}

/**
 * Valide l'environnement.
 *
 * @throws Error si l'adresse du broker n'est pas une URL http(s) ou si l'intervalle est invalide.
 */
export function readConfig(env: MobileEnv): MobileConfig {
  const apiUrl = (env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+/.test(apiUrl)) {
    throw new Error(`EXPO_PUBLIC_API_URL invalide : ${apiUrl}`);
  }
  const probeIntervalMs = Number(env.EXPO_PUBLIC_PROBE_INTERVAL_MS ?? 5_000);
  if (!Number.isInteger(probeIntervalMs) || probeIntervalMs < 500) {
    throw new Error('EXPO_PUBLIC_PROBE_INTERVAL_MS doit être un entier ≥ 500');
  }
  return { apiUrl, accessToken: env.EXPO_PUBLIC_ACCESS_TOKEN, databaseName: 'hygia.db', probeIntervalMs };
}
