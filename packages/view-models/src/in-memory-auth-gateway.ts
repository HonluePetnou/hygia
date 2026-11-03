import type { Role } from '@hygia/types';
import type { AuthGateway } from './gateways.js';
import { GatewayError } from './http-client.js';
import type { AuthSession, LoginChallenge, MfaEnrollment, SecondFactor } from './types.js';

/** Code de démonstration du mode hors ligne (aucun service Identité). */
export const DEMO_MFA_CODE = '481516';

/** Compte du mode hors ligne. */
export interface OfflineUser {
  id: string;
  displayName: string;
  role: Role;
}

/**
 * Connexion hors ligne (`NEXT_PUBLIC_DEMO_OFFLINE=1`, tests) : tout e-mail et mot de passe non
 * vides sont acceptés et le second facteur est le code fixe `481516`. Aucun jeton réel n'existe,
 * aucun service n'est appelé : à ne jamais utiliser avec les services.
 */
export class InMemoryAuthGateway implements AuthGateway {
  private email = '';

  constructor(
    private readonly user: OfflineUser,
    private readonly expectedCode: string = DEMO_MFA_CODE,
  ) {}

  login(email: string, password: string): Promise<LoginChallenge> {
    if (email.trim() === '' || password === '') {
      return Promise.reject(new GatewayError(401, 'Identifiants invalides'));
    }
    this.email = email.trim();
    return Promise.resolve({ challengeId: 'offline', mfa: 'verify' });
  }

  enroll(): Promise<MfaEnrollment> {
    return Promise.reject(new GatewayError(400, 'Enrôlement indisponible hors ligne'));
  }

  verify(_challengeId: string, factor: SecondFactor): Promise<AuthSession> {
    if (!('code' in factor) || factor.code !== this.expectedCode) {
      return Promise.reject(new GatewayError(401, 'Code incorrect ou expiré'));
    }
    return Promise.resolve({
      accessToken: 'hors-ligne',
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      user: { ...this.user, email: this.email },
    });
  }
}
