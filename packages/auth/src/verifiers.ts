import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
} from 'jose';
import { parseClaims, type TokenClaims, type TokenVerifier } from './claims.js';

/** Vérificateur à partir d'une source de clés (JWKS local ou distant). */
export class JwksTokenVerifier implements TokenVerifier {
  constructor(
    private readonly keys: JWTVerifyGetKey,
    /** Horloge utilisée pour juger l'expiration (tests déterministes). */
    private readonly now: () => Date = () => new Date(),
  ) {}

  async verify(token: string): Promise<TokenClaims> {
    const { payload } = await jwtVerify(token, this.keys, {
      algorithms: ['ES256'],
      currentDate: this.now(),
    });
    return parseClaims(payload as Record<string, unknown>);
  }
}

/** Vérificateur qui récupère la clé publique sur l'URL JWKS du service Identité. */
export function remoteVerifier(jwksUrl: string): TokenVerifier {
  return new JwksTokenVerifier(createRemoteJWKSet(new URL(jwksUrl)));
}

/** Vérificateur à partir d'un JWKS déjà connu (tests, démarrage hors ligne). */
export function localVerifier(jwks: JSONWebKeySet, now?: () => Date): TokenVerifier {
  return new JwksTokenVerifier(createLocalJWKSet(jwks), now);
}
