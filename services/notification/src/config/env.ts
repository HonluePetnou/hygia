/** Configuration validée du service. */
export interface Env {
  /** Port d'écoute HTTP (`NOTIFICATION_PORT`, défaut 3008). */
  port: number;
  /** URL du JWKS du service Identité (`IDENTITE_JWKS_URL`). */
  jwksUrl: string;
  /** Secret du webhook WhatsApp (`WHATSAPP_WEBHOOK_TOKEN`, valeur de démonstration par défaut). */
  webhookToken: string;
  /** Clé des appels internes entre services (`NOTIFICATION_INTERNAL_KEY`). */
  internalKey: string;
  /** Période de planification des rappels en ms (`REMINDER_INTERVAL_MS`, 0 = désactivée). */
  reminderIntervalMs: number;
}

const DEFAULT_JWKS_URL = 'http://localhost:3004/.well-known/jwks.json';

function integer(
  source: Record<string, string | undefined>,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = source[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} invalide : « ${raw} » (entier entre ${min} et ${max} attendu)`);
  }
  return value;
}

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
  return {
    port: integer(source, 'NOTIFICATION_PORT', 3008, 1, 65535),
    jwksUrl,
    webhookToken: source['WHATSAPP_WEBHOOK_TOKEN'] || 'demo-whatsapp-token',
    internalKey: source['NOTIFICATION_INTERNAL_KEY'] || 'demo-notification-key',
    reminderIntervalMs: integer(source, 'REMINDER_INTERVAL_MS', 0, 0, 86_400_000),
  };
}
