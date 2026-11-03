import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { localVerifier, remoteVerifier } from '@hygia/auth';
import { NANA_ID } from '@hygia/fhir';
import request from 'supertest';
import { DEMO_BACKUP_CODES, DEMO_PASSWORD, DEMO_SEEDS, DEMO_TOTP_SECRET } from '../src/accounts/demo-accounts.js';
import { AppModule } from '../src/app.module.js';
import { TOKEN_ISSUER } from '../src/auth/session-tokens.js';
import { loadEnv } from '../src/config/env.js';
import { setupDocs } from '../src/docs.js';
import { EVENT_BUS, type InMemoryEventBus } from '../src/events/event-bus.js';
import { TotpService } from '../src/security/totp.service.js';
import { CLOCK, type Clock } from '../src/time/clock.js';
import type { TokenIssuer } from '@hygia/auth';

const JEAN_ID = '00000000-0000-4000-8000-030000000002';
const NANA_EMAIL = 'aicha.nana@hd-bonassama.cm';

class FakeClock implements Clock {
  constructor(public current = new Date('2026-11-05T09:00:00Z')) {}
  now(): Date {
    return this.current;
  }
}

describe('service Identité', () => {
  let app: INestApplication;
  let clock: FakeClock;
  let totp: TotpService;
  let bus: InMemoryEventBus;
  let issuer: TokenIssuer;

  beforeAll(() => {
    process.env['IDENTITE_BCRYPT_COST'] = '4';
  });

  beforeEach(async () => {
    clock = new FakeClock();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .compile();
    app = module.createNestApplication();
    setupDocs(app);
    await app.init();
    totp = module.get(TotpService);
    bus = module.get(EVENT_BUS);
    issuer = module.get(TOKEN_ISSUER);
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function challengeFor(email: string, password = DEMO_PASSWORD): Promise<string> {
    const res = await http().post('/auth/login').send({ email, password }).expect(200);
    return res.body.challengeId as string;
  }

  /** Connexion complète avec le code TOTP courant ; renvoie le jeton. */
  async function signIn(email: string): Promise<string> {
    const challengeId = await challengeFor(email);
    const code = await totp.currentCode(DEMO_TOTP_SECRET, clock.now());
    const res = await http().post('/auth/mfa/verify').send({ challengeId, code }).expect(200);
    return res.body.accessToken as string;
  }

  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

  it('expose /health et /metrics sans jeton', async () => {
    expect((await http().get('/health').expect(200)).body).toEqual({ status: 'ok', service: 'identite' });
    expect((await http().get('/metrics').expect(200)).body).toMatchObject({ service: 'identite', errors: 0 });
  });

  it('un compte de démonstration par rôle, mots de passe hachés', async () => {
    const roles = new Set(DEMO_SEEDS.map((seed) => seed.role));
    expect([...roles].sort()).toEqual(
      ['admin', 'administratif', 'analyste', 'auditeur', 'infirmier', 'medecin', 'patient'],
    );
    for (const seed of DEMO_SEEDS) {
      const token = await signIn(seed.email);
      const me = await http().get('/auth/me').set(bearer(token)).expect(200);
      expect(me.body.role).toBe(seed.role);
      expect(JSON.stringify(me.body)).not.toContain('passwordHash');
    }
  });

  it('refuse un mauvais mot de passe ou un compte inconnu avec le même message', async () => {
    const wrong = await http().post('/auth/login').send({ email: NANA_EMAIL, password: 'non' }).expect(401);
    const unknown = await http().post('/auth/login').send({ email: 'x@y.z', password: 'non' }).expect(401);
    expect(wrong.body.message).toBe(unknown.body.message);
    await http().post('/auth/login').send({ email: NANA_EMAIL }).expect(400);
  });

  it('TOTP : code valide accepté, code invalide ou périmé refusé', async () => {
    const good = await totp.currentCode(DEMO_TOTP_SECRET, clock.now());
    const bad = good === '000000' ? '000001' : '000000';
    const challengeId = await challengeFor(NANA_EMAIL);
    await http().post('/auth/mfa/verify').send({ challengeId, code: bad }).expect(401);
    await http().post('/auth/mfa/verify').send({ challengeId, code: 'abcdef' }).expect(401);
    const ok = await http().post('/auth/mfa/verify').send({ challengeId, code: good }).expect(200);
    expect(ok.body.user.role).toBe('medecin');

    const stale = await totp.currentCode(DEMO_TOTP_SECRET, clock.now());
    clock.current = new Date(clock.current.getTime() + 5 * 60 * 1000);
    const next = await challengeFor(NANA_EMAIL);
    await http().post('/auth/mfa/verify').send({ challengeId: next, code: stale }).expect(401);
  });

  it('bloque l’étape après 5 essais ratés', async () => {
    const challengeId = await challengeFor(NANA_EMAIL);
    for (let i = 0; i < 5; i += 1) {
      await http().post('/auth/mfa/verify').send({ challengeId, code: '000000' }).expect(401);
    }
    const good = await totp.currentCode(DEMO_TOTP_SECRET, clock.now());
    await http().post('/auth/mfa/verify').send({ challengeId, code: good }).expect(401);
  });

  it('codes de secours : usage unique', async () => {
    const first = await challengeFor(NANA_EMAIL);
    const code = DEMO_BACKUP_CODES[0];
    await http().post('/auth/mfa/verify').send({ challengeId: first, backupCode: code }).expect(200);
    const second = await challengeFor(NANA_EMAIL);
    await http().post('/auth/mfa/verify').send({ challengeId: second, backupCode: code }).expect(401);
  });

  it('enrôlement : QR code, confirmation par un code, puis codes de secours', async () => {
    const admin = await signIn('admin@hygia.local');
    await http()
      .post('/comptes')
      .set(bearer(admin))
      .send({ email: 'neo@hygia.local', displayName: 'Néo', role: 'analyste', password: 'motdepasse-1' })
      .expect(201);

    const login = await http()
      .post('/auth/login')
      .send({ email: 'neo@hygia.local', password: 'motdepasse-1' })
      .expect(200);
    expect(login.body.mfa).toBe('enroll');
    const challengeId = login.body.challengeId as string;

    const enroll = await http().post('/auth/mfa/enroll').send({ challengeId }).expect(200);
    expect(enroll.body.qrCode).toMatch(/^data:image\/png;base64,/);
    expect(enroll.body.otpauthUri).toContain('otpauth://totp/');
    await http().post('/auth/mfa/verify').send({ challengeId, code: '000000' }).expect(401);

    const code = await totp.currentCode(enroll.body.secret as string, clock.now());
    const done = await http().post('/auth/mfa/verify').send({ challengeId, code }).expect(200);
    expect(done.body.backupCodes).toHaveLength(8);

    const again = await http()
      .post('/auth/login')
      .send({ email: 'neo@hygia.local', password: 'motdepasse-1' })
      .expect(200);
    expect(again.body.mfa).toBe('verify');
  });

  it('jeton : 30 min, rôle et équipes, clé publique sur /.well-known/jwks.json', async () => {
    const token = await signIn(NANA_EMAIL);
    const jwks = await http().get('/.well-known/jwks.json').expect(200);
    expect(JSON.stringify(jwks.body)).not.toContain('"d"');
    const claims = await localVerifier(jwks.body, () => clock.now()).verify(token);
    expect(claims.sub).toBe(NANA_ID);
    expect(claims.role).toBe('medecin');
    expect(claims.teams).toHaveLength(1);
    expect(claims.exp).toBe(Math.floor(clock.now().getTime() / 1000) + 1800);
    expect(issuer.jwks().keys).toHaveLength(1);
  });

  it('jeton expiré après 30 min : 401, renouvellement possible avant', async () => {
    const token = await signIn(NANA_EMAIL);
    clock.current = new Date('2026-11-05T09:29:59Z');
    await http().get('/auth/me').set(bearer(token)).expect(200);
    const renewed = await http().post('/auth/refresh').set(bearer(token)).expect(200);
    clock.current = new Date('2026-11-05T09:30:01Z');
    await http().get('/auth/me').set(bearer(token)).expect(401);
    await http().get('/auth/me').set(bearer(renewed.body.accessToken)).expect(200);
    await http().get('/auth/me').expect(401);
    await http().get('/auth/me').set(bearer('n.importe.quoi')).expect(401);
  });

  it('bris de glace : accès de 4 h dans le jeton, DPO notifiée, expiré après 4 h', async () => {
    const token = await signIn(NANA_EMAIL);
    const opened = await http()
      .post('/bris-de-glace')
      .set(bearer(token))
      .send({ patientId: JEAN_ID, motif: 'urgence vitale', precisions: 'arrêt cardiaque' })
      .expect(201);
    expect(opened.body.expiresAt).toBe('2026-11-05T13:00:00.000Z');
    const verifier = localVerifier(issuer.jwks(), () => clock.now());
    expect((await verifier.verify(opened.body.accessToken)).emergency).toEqual([
      { patientId: JEAN_ID, expiresAt: '2026-11-05T13:00:00.000Z' },
    ]);
    expect(bus.published).toHaveLength(1);
    expect(bus.published[0]).toMatchObject({
      type: 'bris_de_glace.ouvert',
      recipient: 'dpo',
      payload: { accountId: NANA_ID, patientId: JEAN_ID, motif: 'urgence vitale' },
    });

    clock.current = new Date('2026-11-05T12:59:59Z');
    const before = await signIn(NANA_EMAIL);
    expect((await verifier.verify(before)).emergency).toHaveLength(1);

    clock.current = new Date('2026-11-05T13:00:01Z');
    const after = await signIn(NANA_EMAIL);
    expect((await verifier.verify(after)).emergency).toHaveLength(0);
  });

  it('bris de glace : 400 sans motif, 403 hors soignants, 401 sans jeton', async () => {
    const nana = await signIn(NANA_EMAIL);
    await http().post('/bris-de-glace').set(bearer(nana)).send({ patientId: JEAN_ID }).expect(400);
    const admin = await signIn('admin@hygia.local');
    await http().post('/bris-de-glace').set(bearer(admin)).send({ patientId: JEAN_ID, motif: 'x' }).expect(403);
    await http().post('/bris-de-glace').send({ patientId: JEAN_ID, motif: 'x' }).expect(401);
    expect(bus.published).toHaveLength(0);
  });

  it('administration : comptes et équipes réservés à l’admin', async () => {
    const nana = await signIn(NANA_EMAIL);
    await http().get('/comptes').set(bearer(nana)).expect(403);
    await http().get('/equipes').set(bearer(nana)).expect(403);

    const admin = await signIn('admin@hygia.local');
    const accounts = await http().get('/comptes').set(bearer(admin)).expect(200);
    expect(accounts.body).toHaveLength(DEMO_SEEDS.length);
    const team = await http().post('/equipes').set(bearer(admin)).send({ name: 'Urgences' }).expect(201);
    await http()
      .post(`/equipes/${team.body.id}/membres`)
      .set(bearer(admin))
      .send({ accountId: '00000000-0000-4000-8000-020000000003' })
      .expect(200);
    await http().post(`/equipes/${team.body.id}/membres`).set(bearer(admin)).send({ accountId: 'inconnu' }).expect(404);

    const kamga = await signIn('paul.kamga@cma-bepanda.cm');
    const claims = await localVerifier(issuer.jwks(), () => clock.now()).verify(kamga);
    expect(claims.teams).toEqual([team.body.id]);
  });

  it('sert la spécification OpenAPI sur /docs', async () => {
    const spec = await http().get('/docs-json').expect(200);
    expect(Object.keys(spec.body.paths)).toContain('/bris-de-glace');
  });

  it('un vérificateur distant refuse une URL JWKS invalide', () => {
    expect(() => remoteVerifier('pas une url')).toThrow();
  });
});

describe('loadEnv', () => {
  it('défauts, valeurs valides et erreurs explicites', () => {
    expect(loadEnv({})).toEqual({ port: 3004, bcryptCost: 10 });
    expect(loadEnv({ IDENTITE_PORT: '4004' }).port).toBe(4004);
    expect(() => loadEnv({ IDENTITE_PORT: 'abc' })).toThrow(/IDENTITE_PORT/);
    expect(() => loadEnv({ IDENTITE_BCRYPT_COST: '2' })).toThrow(/IDENTITE_BCRYPT_COST/);
    expect(() => loadEnv({ IDENTITE_JWT_PRIVATE_KEY: 'nope' })).toThrow(/IDENTITE_JWT_PRIVATE_KEY/);
  });
});
