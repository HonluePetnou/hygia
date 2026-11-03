import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TokenIssuer, localVerifier } from '@hygia/auth';
import { FLORENCE_ID, NANA_ID, type SearchResponse } from '@hygia/fhir';
import type { Role } from '@hygia/types';
import request from 'supertest';
import { CLOCK, type Clock } from '../src/access/clock.js';
import { AppModule } from '../src/app.module.js';
import { TOKEN_VERIFIER } from '../src/auth/jwt-auth.guard.js';

const TEAM_ID = '00000000-0000-4000-8000-040000000001';
const KAMGA_ID = '00000000-0000-4000-8000-020000000003';

class FakeClock implements Clock {
  now(): Date {
    return new Date('2026-11-05T09:00:00Z');
  }
}

describe('POST /recherche (RF14)', () => {
  let app: INestApplication;
  let issuer: TokenIssuer;
  const clock = new FakeClock();

  async function as(sub: string, role: Role, teams: string[] = []): Promise<Record<string, string>> {
    const { token } = await issuer.issue({ sub, role, teams, emergency: [] }, clock.now());
    return { authorization: `Bearer ${token}` };
  }

  beforeEach(async () => {
    issuer = await TokenIssuer.create();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(localVerifier(issuer.jwks(), () => clock.now()))
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (headers: Record<string, string>, body: unknown) =>
    request(app.getHttpServer()).post('/recherche').set(headers).send(body as object);

  it('renvoie les filtres compris et les résultats', async () => {
    const nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    const res = await post(nana, { requete: 'insuffisance cardiaque avec FEVG < 50 %' }).expect(200);
    const body = res.body as SearchResponse;
    expect(body.filtres.map((f) => f.kind)).toEqual(['lab', 'diagnosis']);
    expect(body.resultats.map((r) => r.id)).toEqual([FLORENCE_ID]);
    expect(body.resultats[0]).toMatchObject({ ipp: 'HYG-2024-00871', language: 'fr' });
    expect(body.total).toBe(1);
  });

  it('utilise les filtres fournis sans réinterpréter la requête (puce supprimée)', async () => {
    const nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    const first = (await post(nana, { requete: 'diabétiques' }).expect(200)).body as SearchResponse;
    expect(first.total).toBe(0);
    const second = (await post(nana, { filtres: [], requete: 'diabétiques' }).expect(200)).body as SearchResponse;
    expect(second.filtres).toEqual([]);
    expect(second.total).toBeGreaterThan(0);
  });

  it('pagine', async () => {
    const nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    const all = (await post(nana, { filtres: [] }).expect(200)).body as SearchResponse;
    const page2 = (await post(nana, { filtres: [], page: 2, taille: 1 }).expect(200)).body as SearchResponse;
    expect(page2.resultats).toHaveLength(1);
    expect(page2.resultats[0]?.id).toBe(all.resultats[1]?.id);
    expect(page2.total).toBe(all.total);
  });

  it('audite la lecture de chaque dossier affiché', async () => {
    const nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    await post(nana, { requete: 'insuffisance cardiaque' }).expect(200);
    const log = await request(app.getHttpServer()).get(`/patients/${FLORENCE_ID}/acces`).set(nana).expect(200);
    expect(JSON.stringify(log.body)).toContain('"resourceType":"Recherche"');
  });

  it('refuse les rôles non cliniques, ne montre rien hors équipe, valide le corps', async () => {
    await post(await as('aud', 'auditeur'), { requete: 'x' }).expect(403);
    const kamga = await as(KAMGA_ID, 'medecin');
    expect(((await post(kamga, { filtres: [] }).expect(200)).body as SearchResponse).total).toBe(0);
    const nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    await post(nana, {}).expect(400);
    await post(nana, { requete: 'x', taille: 0 }).expect(400);
    await post(nana, { filtres: [{ kind: 'bidon' }] }).expect(400);
    await request(app.getHttpServer()).post('/recherche').send({ requete: 'x' }).expect(401);
  });
});
