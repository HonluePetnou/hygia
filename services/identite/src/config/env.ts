/** Configuration validée du service. */
export interface Env {
  /** Port d'écoute HTTP (`IDENTITE_PORT`, défaut 3004). */
  port: number;
  /** Coût bcrypt des mots de passe (`IDENTITE_BCRYPT_COST`, 4 à 15, défaut 10). */
  bcryptCost: number;
  /** Clé de signature PKCS#8 PEM (`IDENTITE_JWT_PRIVATE_KEY`) ; absente : clé éphémère. */
  privateKeyPem?: string;
}

type Source = Record<string, string | undefined>;

function integer(source: Source, key: string, fallback: number, min: number, max: number): number {
  const raw = source[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${key} invalide : « ${raw} » (entier entre ${min} et ${max} attendu)`);
  }
  return value;
}

/**
 * Valide les variables d'environnement au démarrage.
 *
 * @param source Variables à lire (par défaut `process.env`).
 * @throws Error si une variable est invalide.
 */
export function loadEnv(source: Source = process.env): Env {
  const pem = source['IDENTITE_JWT_PRIVATE_KEY'];
  if (pem !== undefined && pem !== '' && !pem.includes('BEGIN PRIVATE KEY')) {
    throw new Error('IDENTITE_JWT_PRIVATE_KEY invalide : clé PKCS#8 au format PEM attendue');
  }
  return {
    port: integer(source, 'IDENTITE_PORT', 3004, 1, 65535),
    bcryptCost: integer(source, 'IDENTITE_BCRYPT_COST', 10, 4, 15),
    ...(pem ? { privateKeyPem: pem } : {}),
  };
}
