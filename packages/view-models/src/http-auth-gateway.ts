import type { AuthGateway } from './gateways.js';
import { HttpClient } from './http-client.js';
import type { AuthSession, LoginChallenge, MfaEnrollment, SecondFactor } from './types.js';

/** Passerelle HTTP vers le service Identité (`/auth/login`, `/auth/mfa/enroll`, `/auth/mfa/verify`). */
export class HttpAuthGateway implements AuthGateway {
  private readonly client: HttpClient;

  /** @param baseUrl Adresse du service Identité derrière le broker (`<broker>/api/identite`). */
  constructor(baseUrl: string, fetchFn?: typeof fetch) {
    // Ces routes sont publiques : aucun jeton n'est joint.
    this.client = new HttpClient(baseUrl, () => ({ userId: '', role: 'patient' }), fetchFn);
  }

  login(email: string, password: string): Promise<LoginChallenge> {
    return this.client.post('/auth/login', { email, password });
  }

  enroll(challengeId: string): Promise<MfaEnrollment> {
    return this.client.post('/auth/mfa/enroll', { challengeId });
  }

  verify(challengeId: string, factor: SecondFactor): Promise<AuthSession> {
    return this.client.post('/auth/mfa/verify', { challengeId, ...factor });
  }
}
