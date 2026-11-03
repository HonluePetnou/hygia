import { describe, expect, it, vi } from 'vitest';
import {
  GatewayError,
  HttpAuthGateway,
  HttpPatientsGateway,
  SessionViewModel,
  type AuthGateway,
  type AuthSession,
} from '../src/index.js';

const session: AuthSession = {
  accessToken: 'jwt.nana',
  expiresAt: '2026-11-05T09:30:00.000Z',
  user: { id: 'u-nana', email: 'nana@hygia.test', displayName: 'Dr Aïcha Nana', role: 'medecin' },
};

function fakeAuth(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    login: vi.fn(async () => ({ challengeId: 'c1', mfa: 'verify' as const })),
    enroll: vi.fn(async () => ({ secret: 'SECRET', otpauthUri: 'otpauth://x', qrCode: 'data:image/png;base64,AA' })),
    verify: vi.fn(async () => session),
    ...overrides,
  };
}

describe('SessionViewModel avec le service Identité', () => {
  it('ouvre la session avec le jeton, le rôle et le nom renvoyés par le service', async () => {
    const auth = fakeAuth();
    const vm = new SessionViewModel({ auth });
    expect(await vm.submitCredentials(' nana@hygia.test ', 'pw')).toBe(true);
    expect(auth.login).toHaveBeenCalledWith('nana@hygia.test', 'pw');
    expect(vm.step).toBe('code');
    expect(await vm.submitCode('123456')).toBe(true);
    expect(auth.verify).toHaveBeenCalledWith('c1', { code: '123456' });
    expect(vm.isAuthenticated).toBe(true);
    expect(vm.identity).toEqual({ userId: 'u-nana', role: 'medecin', token: 'jwt.nana' });
    expect(vm.displayName).toBe('Dr Aïcha Nana');
    vm.signOut();
    expect(vm.identity.token).toBeUndefined();
  });

  it('affiche une erreur sur un refus 401 et une autre si le service est indisponible', async () => {
    const refused = new SessionViewModel({
      auth: fakeAuth({ login: async () => Promise.reject(new GatewayError(401, 'login')) }),
    });
    expect(await refused.submitCredentials('a@b.c', 'pw')).toBe(false);
    expect(refused.errorKey).toBe('login.error');

    const down = new SessionViewModel({
      auth: fakeAuth({ login: async () => Promise.reject(new TypeError('fetch failed')) }),
    });
    expect(await down.submitCredentials('a@b.c', 'pw')).toBe(false);
    expect(down.errorKey).toBe('login.unavailable');
    expect(down.submitting).toBe(false);
  });

  it('refuse un code rejeté par le service ; le code de secours passe par backupCode', async () => {
    const verify = vi.fn(async (_id: string, factor: object) =>
      'backupCode' in factor ? session : Promise.reject(new GatewayError(401, 'verify')),
    );
    const vm = new SessionViewModel({ auth: fakeAuth({ verify }) });
    await vm.submitCredentials('a@b.c', 'pw');
    expect(await vm.submitCode('000000')).toBe(false);
    expect(vm.errorKey).toBe('mfa.error');
    vm.toggleBackupMode();
    expect(await vm.submitBackupCode(' abcde12345 ')).toBe(true);
    expect(verify).toHaveBeenLastCalledWith('c1', { backupCode: 'abcde12345' });
  });

  it('enrôlement : QR code, puis codes de secours à acquitter avant d’entrer', async () => {
    const auth = fakeAuth({
      login: async () => ({ challengeId: 'c2', mfa: 'enroll' }),
      verify: async () => ({ ...session, backupCodes: ['aaaa111111', 'bbbb222222'] }),
    });
    const vm = new SessionViewModel({ auth });
    await vm.submitCredentials('neo@hygia.test', 'pw');
    expect(vm.step).toBe('enroll');
    expect(vm.enrollment?.qrCode).toContain('data:image/png');
    await vm.submitCode('123456');
    expect(vm.step).toBe('backupCodes');
    expect(vm.isAuthenticated).toBe(false);
    expect(vm.backupCodes).toHaveLength(2);
    vm.acknowledgeBackupCodes();
    expect(vm.isAuthenticated).toBe(true);
    expect(vm.backupCodes).toEqual([]);
  });
});

describe('passerelles HTTP du service Identité', () => {
  it('HttpAuthGateway : routes publiques, sans Authorization', async () => {
    const fetchFn = vi.fn(async () => Response.json({ challengeId: 'c1', mfa: 'verify' }));
    const gateway = new HttpAuthGateway('http://broker.test/api/identite', fetchFn as unknown as typeof fetch);
    await gateway.login('a@b.c', 'pw');
    await gateway.verify('c1', { backupCode: 'x' });
    const [loginUrl, loginInit] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(loginUrl).toBe('http://broker.test/api/identite/auth/login');
    expect(loginInit.headers).not.toHaveProperty('authorization');
    const [, verifyInit] = fetchFn.mock.calls[1] as unknown as [string, RequestInit];
    expect(verifyInit.body).toBe(JSON.stringify({ challengeId: 'c1', backupCode: 'x' }));
  });

  it('bris de glace : service Identité d’abord, nouveau jeton adopté, puis trace dans Dossiers', async () => {
    const calls: Array<{ url: string; auth: string | undefined }> = [];
    let token = 'jwt.avant';
    const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, auth: (init.headers as Record<string, string>)['authorization'] });
      return url.endsWith('/identite/bris-de-glace')
        ? Response.json({ patientId: 'p1', expiresAt: '2026-11-05T13:00:00.000Z', accessToken: 'jwt.urgence' })
        : Response.json({ patientId: 'p1', expiresAt: '2026-11-05T13:00:00.000Z' });
    });
    const gateway = new HttpPatientsGateway(
      { dossiersUrl: 'http://b/api/dossiers', iaCliniqueUrl: 'http://b/api/ia-clinique', identiteUrl: 'http://b/api/identite' },
      () => ({ userId: 'u', role: 'medecin', token }),
      fetchFn as unknown as typeof fetch,
      (next) => {
        token = next;
      },
    );
    const grant = await gateway.openBreakGlass('p1', { motif: 'urgence vitale', precisions: 'arrêt cardiaque' });
    expect(grant.expiresAt).toBe('2026-11-05T13:00:00.000Z');
    expect(calls).toEqual([
      { url: 'http://b/api/identite/bris-de-glace', auth: 'Bearer jwt.avant' },
      { url: 'http://b/api/dossiers/patients/p1/bris-de-glace', auth: 'Bearer jwt.urgence' },
    ]);
  });
});
