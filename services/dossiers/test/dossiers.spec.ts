import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TokenIssuer, localVerifier, type EmergencyAccess } from '@hygia/auth';
import { FLORENCE_ID, NANA_ID } from '@hygia/fhir';
import type { Role } from '@hygia/types';
import request from 'supertest';
import { CLOCK, type Clock } from '../src/access/clock.js';
import { AppModule } from '../src/app.module.js';
import { TOKEN_VERIFIER } from '../src/auth/jwt-auth.guard.js';
import { loadEnv } from '../src/config/env.js';
import { setupDocs } from '../src/docs.js';

const KAMGA_ID = '00000000-0000-4000-8000-020000000003';
const JEAN_ID = '00000000-0000-4000-8000-030000000002';

class FakeClock implements Clock {
  constructor(public current = new Date('2026-11-05T09:00:00Z')) {}
  now(): Date {
    return this.current;
  }
}

const TEAM_ID = '00000000-0000-4000-8000-040000000001';

describe('service Dossiers', () => {
  let app: INestApplication;
  let clock: FakeClock;
  let issuer: TokenIssuer;
  let nana: Record<string, string>;
  let kamga: Record<string, string>;
  let admin: Record<string, string>;
  let auditeur: Record<string, string>;

  /** En-tête Authorization d'un jeton signé par un « service Identité » de test. */
  async function as(
    sub: string,
    role: Role,
    teams: string[] = [],
    emergency: EmergencyAccess[] = [],
  ): Promise<Record<string, string>> {
    const { token } = await issuer.issue({ sub, role, teams, emergency }, clock.now());
    return { authorization: `Bearer ${token}` };
  }

  beforeEach(async () => {
    clock = new FakeClock();
    issuer = await TokenIssuer.create();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(localVerifier(issuer.jwks(), () => clock.now()))
      .compile();
    app = module.createNestApplication();
    setupDocs(app);
    await app.init();
    nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    kamga = await as(KAMGA_ID, 'medecin');
    admin = await as('root', 'admin');
    auditeur = await as('aud', 'auditeur');
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('401 sans jeton, avec un faux jeton, un jeton d’une autre clé ou des en-têtes simulés', async () => {
    await http().get(`/patients/${FLORENCE_ID}`).expect(401);
    await http().get('/patients').set({ authorization: 'Bearer faux.jeton.ici' }).expect(401);
    const other = await TokenIssuer.create();
    const forged = await other.issue(
      { sub: NANA_ID, role: 'medecin', teams: [TEAM_ID], emergency: [] },
      clock.now(),
    );
    await http().get('/patients').set({ authorization: `Bearer ${forged.token}` }).expect(401);
    await http()
      .get('/patients')
      .set({ 'x-user-id': NANA_ID, 'x-user-role': 'medecin' })
      .expect(401);
  });

  it('401 une fois le jeton expiré (30 min)', async () => {
    await http().get(`/patients/${FLORENCE_ID}`).set(nana).expect(200);
    clock.current = new Date('2026-11-05T09:30:01Z');
    await http().get(`/patients/${FLORENCE_ID}`).set(nana).expect(401);
  });

  it('un jeton admin ne donne accès à aucune donnée de santé', async () => {
    const urls = [
      '/patients',
      `/patients/${FLORENCE_ID}`,
      `/patients/${FLORENCE_ID}/chronologie`,
      `/patients/${FLORENCE_ID}/acces`,
    ];
    for (const url of urls) await http().get(url).set(admin).expect(403);
    await http().patch(`/patients/${FLORENCE_ID}`).set(admin).set('If-Match', '1').send({ givenName: 'X' }).expect(403);
    // Même avec une équipe et un accès d'urgence dans le jeton, le rôle admin reste refusé.
    const strong = await as('root', 'admin', [TEAM_ID], [
      { patientId: FLORENCE_ID, expiresAt: '2026-11-05T13:00:00.000Z' },
    ]);
    await http().get(`/patients/${FLORENCE_ID}`).set(strong).expect(403);
  });

  it('200 pour un membre de l’équipe de soins, ETag = version', async () => {
    const res = await http().get(`/patients/${FLORENCE_ID}`).set(nana).expect(200);
    expect(res.body.ipp).toBe('HYG-2024-00871');
    expect(res.headers['etag']).toBe('"1"');
  });

  it('403 hors équipe et pour l’administrateur système', async () => {
    await http().get(`/patients/${FLORENCE_ID}`).set(kamga).expect(403);
    await http().get(`/patients/${FLORENCE_ID}`).set(admin).expect(403);
    await http()
      .post(`/patients/${FLORENCE_ID}/bris-de-glace`)
      .set(admin)
      .send({ motif: 'x' })
      .expect(403);
  });

  it('recherche limitée aux patients de l’équipe (nom ou IPP, sans accents)', async () => {
    const byName = await http().get('/patients?q=ngo').set(nana).expect(200);
    expect(byName.body).toHaveLength(1);
    await http()
      .get('/patients?q=HYG-2024-00871')
      .set(nana)
      .expect(200)
      .expect((r) => {
        expect(r.body).toHaveLength(1);
      });
    const other = await http().get('/patients?q=mbarga').set(nana).expect(200);
    expect(other.body).toHaveLength(0);
  });

  it('chronologie triée du plus récent au plus ancien', async () => {
    const res = await http().get(`/patients/${FLORENCE_ID}/chronologie`).set(nana).expect(200);
    const dates = (res.body as { date: string }[]).map((e) => Date.parse(e.date));
    expect(dates.length).toBeGreaterThan(3);
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
    const types = new Set((res.body as { type: string }[]).map((e) => e.type));
    expect(types).toContain('consultation');
    expect(types).toContain('prescription');
  });

  it('PATCH : 200 puis 409 sur version périmée, 400 sans If-Match', async () => {
    const url = `/patients/${FLORENCE_ID}`;
    const ok = await http()
      .patch(url)
      .set(nana)
      .set('If-Match', '1')
      .send({ givenName: 'Flo' })
      .expect(200);
    expect(ok.body).toMatchObject({ givenName: 'Flo', version: 2 });
    await http().patch(url).set(nana).set('If-Match', '1').send({ givenName: 'X' }).expect(409);
    await http().patch(url).set(nana).send({ givenName: 'X' }).expect(400);
    await http().patch(url).set(nana).set('If-Match', '2').send({}).expect(400);
  });

  it('bris de glace : le jeton d’urgence ouvre l’accès jusqu’à expiration, avec audit', async () => {
    const url = `/patients/${JEAN_ID}`;
    await http().get(url).set(nana).expect(403);
    // Sans accès d'urgence dans le jeton, la trace de bris de glace est refusée.
    await http().post(`${url}/bris-de-glace`).set(nana).send({ motif: 'x' }).expect(403);

    const expiresAt = '2026-11-05T13:00:00.000Z';
    const urgent = await as(NANA_ID, 'medecin', [TEAM_ID], [{ patientId: JEAN_ID, expiresAt }]);
    const opened = await http()
      .post(`${url}/bris-de-glace`)
      .set(urgent)
      .send({ motif: 'urgence vitale', precisions: 'arrêt cardiaque aux urgences' })
      .expect(201);
    expect(opened.body.expiresAt).toBe(expiresAt);
    await http().post(`${url}/bris-de-glace`).set(urgent).send({}).expect(400);

    await http().get(url).set(urgent).expect(200);
    const log = await http().get(`${url}/acces`).set(urgent).expect(200);
    const actions = (log.body as { action: string; reason: string }[]).map((e) => e.action);
    expect(actions).toEqual(['bris_de_glace', 'lecture']);
    expect(log.body[0].reason).toContain('urgence vitale');
    expect(log.body[1].reason).toBe('bris_de_glace');

    clock.current = new Date('2026-11-05T13:00:01Z');
    const late = await as(NANA_ID, 'medecin', [TEAM_ID], [{ patientId: JEAN_ID, expiresAt }]);
    await http().get(url).set(late).expect(403);
  });

  it('chaque lecture et écriture est auditée et la chaîne reste lisible via /acces', async () => {
    const url = `/patients/${FLORENCE_ID}`;
    await http().get(url).set(nana).expect(200);
    await http().patch(url).set(nana).set('If-Match', '1').send({ familyName: 'Ngo' }).expect(200);
    const log = await http().get(`${url}/acces`).set(nana).expect(200);
    expect((log.body as { action: string }[]).map((e) => e.action)).toEqual([
      'lecture',
      'modification',
    ]);
    await http().get(`${url}/acces`).set(kamga).expect(403);
    await http()
      .get(`${url}/acces`)
      .set(auditeur)
      .expect(200);
  });

  it('sert la spécification OpenAPI sur /docs', async () => {
    const spec = await http().get('/docs-json').expect(200);
    expect(Object.keys(spec.body.paths)).toContain('/patients/{id}/bris-de-glace');
  });

  it('404 pour un patient inconnu', async () => {
    await http().get('/patients/inconnu').set(nana).expect(404);
  });
});

describe('loadEnv', () => {
  it('défaut 3001, valeur valide ou erreur explicite', () => {
    expect(loadEnv({})).toMatchObject({ port: 3001 });
    expect(loadEnv({ DOSSIERS_PORT: '4000' })).toMatchObject({ port: 4000 });
    expect(() => loadEnv({ IDENTITE_JWKS_URL: 'pas une url' })).toThrow(/IDENTITE_JWKS_URL/);
    expect(() => loadEnv({ DOSSIERS_PORT: 'abc' })).toThrow(/DOSSIERS_PORT/);
    expect(() => loadEnv({ DOSSIERS_PORT: '70000' })).toThrow(/DOSSIERS_PORT/);
  });
});
