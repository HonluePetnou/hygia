import { describe, expect, it } from 'vitest';
import { TokenIssuer, bearerToken, localVerifier } from '../src/index.js';

const subject = {
  sub: 'u1',
  role: 'medecin' as const,
  teams: ['t1'],
  emergency: [{ patientId: 'p1', expiresAt: '2026-11-05T13:00:00.000Z' }],
};
const t0 = new Date('2026-11-05T09:00:00Z');

describe('jeton d’accès', () => {
  it('signe puis vérifie les revendications (rôle, équipes, urgences)', async () => {
    const issuer = await TokenIssuer.create();
    const { token, expiresAt } = await issuer.issue(subject, t0);
    expect(expiresAt.toISOString()).toBe('2026-11-05T09:30:00.000Z');
    const claims = await localVerifier(issuer.jwks(), () => t0).verify(token);
    expect(claims).toMatchObject(subject);
  });

  it('refuse un jeton expiré après 30 minutes', async () => {
    const issuer = await TokenIssuer.create();
    const { token } = await issuer.issue(subject, t0);
    const later = () => new Date('2026-11-05T09:30:01Z');
    await expect(localVerifier(issuer.jwks(), later).verify(token)).rejects.toThrow();
    const justBefore = () => new Date('2026-11-05T09:29:59Z');
    await expect(localVerifier(issuer.jwks(), justBefore).verify(token)).resolves.toBeDefined();
  });

  it('refuse un jeton signé par une autre clé ou altéré', async () => {
    const issuer = await TokenIssuer.create();
    const other = await TokenIssuer.create();
    const { token } = await other.issue(subject, t0);
    await expect(localVerifier(issuer.jwks(), () => t0).verify(token)).rejects.toThrow();
    await expect(localVerifier(issuer.jwks(), () => t0).verify(`${token}x`)).rejects.toThrow();
  });

  it('extrait le jeton Bearer', () => {
    expect(bearerToken('Bearer abc.def')).toBe('abc.def');
    expect(bearerToken('Basic abc')).toBeUndefined();
    expect(bearerToken(undefined)).toBeUndefined();
  });
});
