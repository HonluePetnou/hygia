import { exportJWK, generateKeyPair, importPKCS8, SignJWT, type CryptoKey, type JWK } from 'jose';
import type { Role } from '@hygia/types';
import { TOKEN_TTL_SECONDS, type EmergencyAccess } from './claims.js';

const ALGORITHM = 'ES256';

/** Données portées par un jeton à l'émission. */
export interface TokenSubject {
  sub: string;
  role: Role;
  teams: string[];
  emergency: EmergencyAccess[];
}

/** Signe les jetons d'accès (ES256, 30 min) et publie la clé publique au format JWKS. */
export class TokenIssuer {
  private constructor(
    private readonly privateKey: CryptoKey,
    private readonly publicJwk: JWK,
    private readonly kid: string,
  ) {}

  /** Crée un émetteur avec une paire de clés neuve, ou la clé PKCS#8 PEM fournie. */
  static async create(options: { privateKeyPem?: string; kid?: string } = {}): Promise<TokenIssuer> {
    const kid = options.kid ?? 'hygia-identite-1';
    if (options.privateKeyPem !== undefined) {
      const privateKey = await importPKCS8(options.privateKeyPem, ALGORITHM, { extractable: true });
      const jwk = await exportJWK(privateKey);
      delete jwk.d;
      return new TokenIssuer(privateKey, jwk, kid);
    }
    const pair = await generateKeyPair(ALGORITHM, { extractable: true });
    return new TokenIssuer(pair.privateKey, await exportJWK(pair.publicKey), kid);
  }

  /** Jeu de clés publiques (`/.well-known/jwks.json`). */
  jwks(): { keys: JWK[] } {
    return { keys: [{ ...this.publicJwk, kid: this.kid, alg: ALGORITHM, use: 'sig' }] };
  }

  /**
   * Émet un jeton.
   * @param now Instant d'émission (horloge injectable pour les tests).
   * @returns Le jeton et son expiration.
   */
  async issue(subject: TokenSubject, now: Date): Promise<{ token: string; expiresAt: Date }> {
    const iat = Math.floor(now.getTime() / 1000);
    const exp = iat + TOKEN_TTL_SECONDS;
    const token = await new SignJWT({
      role: subject.role,
      teams: subject.teams,
      emergency: subject.emergency,
    })
      .setProtectedHeader({ alg: ALGORITHM, kid: this.kid })
      .setSubject(subject.sub)
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .sign(this.privateKey);
    return { token, expiresAt: new Date(exp * 1000) };
  }
}
