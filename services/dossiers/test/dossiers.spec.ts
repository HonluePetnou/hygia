import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FLORENCE_ID, NANA_ID } from '@hygia/fhir';
import request from 'supertest';
import { CLOCK, type Clock } from '../src/access/clock.js';
import { AppModule } from '../src/app.module.js';
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

const nana = { 'x-user-id': NANA_ID, 'x-user-role': 'medecin' };
const kamga = { 'x-user-id': KAMGA_ID, 'x-user-role': 'medecin' };
const admin = { 'x-user-id': 'root', 'x-user-role': 'admin' };

describe('service Dossiers', () => {
  let app: INestApplication;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .compile();
    app = module.createNestApplication();
    setupDocs(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('401 sans en-têtes d’identité ou avec un rôle inconnu', async () => {
    await http().get(`/patients/${FLORENCE_ID}`).expect(401);
    await http().get('/patients').set({ 'x-user-id': 'a', 'x-user-role': 'roi' }).expect(401);
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

  it('bris de glace : ouvre l’accès 4 h puis expire, avec entrées d’audit', async () => {
    const url = `/patients/${JEAN_ID}`;
    await http().get(url).set(nana).expect(403);
    const opened = await http()
      .post(`${url}/bris-de-glace`)
      .set(nana)
      .send({ motif: 'urgence vitale', precisions: 'arrêt cardiaque aux urgences' })
      .expect(201);
    expect(opened.body.expiresAt).toBe('2026-11-05T13:00:00.000Z');
    await http().post(`${url}/bris-de-glace`).set(nana).send({}).expect(400);

    await http().get(url).set(nana).expect(200);
    const log = await http().get(`${url}/acces`).set(nana).expect(200);
    const actions = (log.body as { action: string; reason: string }[]).map((e) => e.action);
    expect(actions).toEqual(['bris_de_glace', 'lecture']);
    expect(log.body[0].reason).toContain('urgence vitale');
    expect(log.body[1].reason).toBe('bris_de_glace');

    clock.current = new Date('2026-11-05T13:00:01Z');
    await http().get(url).set(nana).expect(403);
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
      .set({ 'x-user-id': 'aud', 'x-user-role': 'auditeur' })
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
    expect(loadEnv({})).toEqual({ port: 3001 });
    expect(loadEnv({ DOSSIERS_PORT: '4000' })).toEqual({ port: 4000 });
    expect(() => loadEnv({ DOSSIERS_PORT: 'abc' })).toThrow(/DOSSIERS_PORT/);
    expect(() => loadEnv({ DOSSIERS_PORT: '70000' })).toThrow(/DOSSIERS_PORT/);
  });
});
