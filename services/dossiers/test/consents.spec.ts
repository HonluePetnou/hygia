import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TokenIssuer, localVerifier } from '@hygia/auth';
import { FLORENCE_ID, NANA_ID } from '@hygia/fhir';
import type { Role } from '@hygia/types';
import request from 'supertest';
import { CLOCK, type Clock } from '../src/access/clock.js';
import { AppModule } from '../src/app.module.js';
import { TOKEN_VERIFIER } from '../src/auth/jwt-auth.guard.js';

const TEAM_ID = '00000000-0000-4000-8000-040000000001';
const INTERNAL = { 'x-internal-key': 'demo-dossiers-key' };

class FakeClock implements Clock {
  now(): Date {
    return new Date('2026-11-05T09:00:00Z');
  }
}

const parser = (res: request.Response, done: (error: Error | null, body: Buffer) => void): void => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => done(null, Buffer.concat(chunks)));
};

describe('consentements du patient (RF21)', () => {
  let app: INestApplication;
  let issuer: TokenIssuer;
  const clock = new FakeClock();

  async function as(
    sub: string,
    role: Role,
    teams: string[] = [],
  ): Promise<Record<string, string>> {
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

  const http = () => request(app.getHttpServer());
  const granted = async (purpose: string) =>
    (await http().get(`/internal/consents/${FLORENCE_ID}/${purpose}`).set(INTERNAL).expect(200))
      .body.granted;

  it('liste les cinq finalités avec UUID, version et valeurs par défaut', async () => {
    const res = await http()
      .get(`/patients/${FLORENCE_ID}/consents`)
      .set(await as(FLORENCE_ID, 'patient'))
      .expect(200);
    expect(res.body.language).toBe('fr');
    expect(
      res.body.consents.map((c: { purpose: string; granted: boolean }) => [c.purpose, c.granted]),
    ).toEqual([
      ['soins', true],
      ['ia', true],
      ['statistiques', true],
      ['audio', false],
      ['whatsapp', true],
    ]);
    expect(res.body.consents[0]).toMatchObject({ version: 1, patientId: FLORENCE_ID });
    expect(res.body.consents[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('révoque puis redonne un consentement : date de révocation, version incrémentée, effet sur la route interne', async () => {
    const florence = await as(FLORENCE_ID, 'patient');
    expect(await granted('ia')).toBe(true);
    const revoked = await http()
      .put(`/patients/${FLORENCE_ID}/consents/ia`)
      .set(florence)
      .send({ granted: false })
      .expect(200);
    expect(revoked.body).toMatchObject({
      granted: false,
      version: 2,
      revokedAt: '2026-11-05T09:00:00.000Z',
    });
    expect(await granted('ia')).toBe(false);
    expect(await granted('whatsapp')).toBe(true);
    const again = await http()
      .put(`/patients/${FLORENCE_ID}/consents/ia`)
      .set(florence)
      .send({ granted: true })
      .expect(200);
    expect(again.body).toMatchObject({ granted: true, version: 3 });
    expect(again.body.revokedAt).toBeUndefined();
    expect(await granted('ia')).toBe(true);
  });

  it('contrôle optimiste : 409 si la version lue est périmée', async () => {
    const florence = await as(FLORENCE_ID, 'patient');
    await http()
      .put(`/patients/${FLORENCE_ID}/consents/audio`)
      .set(florence)
      .send({ granted: true, version: 1 })
      .expect(200);
    await http()
      .put(`/patients/${FLORENCE_ID}/consents/audio`)
      .set(florence)
      .send({ granted: false, version: 1 })
      .expect(409);
  });

  it('le consentement aux soins ne se révoque pas ; finalité ou corps invalides : 400', async () => {
    const florence = await as(FLORENCE_ID, 'patient');
    await http()
      .put(`/patients/${FLORENCE_ID}/consents/soins`)
      .set(florence)
      .send({ granted: false })
      .expect(400);
    await http()
      .put(`/patients/${FLORENCE_ID}/consents/autre`)
      .set(florence)
      .send({ granted: false })
      .expect(400);
    await http().put(`/patients/${FLORENCE_ID}/consents/ia`).set(florence).send({}).expect(400);
  });

  it('seul le patient concerné lit et modifie ses consentements', async () => {
    const other = await as('00000000-0000-4000-8000-010000000002', 'patient');
    await http().get(`/patients/${FLORENCE_ID}/consents`).set(other).expect(403);
    await http()
      .put(`/patients/${FLORENCE_ID}/consents/ia`)
      .set(other)
      .send({ granted: false })
      .expect(403);
    await http()
      .get(`/patients/${FLORENCE_ID}/consents`)
      .set(await as(NANA_ID, 'medecin', [TEAM_ID]))
      .expect(403);
    await http().get(`/patients/${FLORENCE_ID}/consents`).expect(401);
    expect(await granted('ia')).toBe(true);
  });

  it('la route interne exige la clé des services', async () => {
    await http().get(`/internal/consents/${FLORENCE_ID}/ia`).expect(401);
    await http()
      .get(`/internal/consents/${FLORENCE_ID}/ia`)
      .set({ 'x-internal-key': 'mauvaise' })
      .expect(401);
    await http().get(`/internal/consents/${FLORENCE_ID}/inconnue`).set(INTERNAL).expect(400);
  });

  it('mémorise la langue du patient pour l’interface', async () => {
    const florence = await as(FLORENCE_ID, 'patient');
    await http()
      .put(`/patients/${FLORENCE_ID}/language`)
      .set(florence)
      .send({ language: 'en' })
      .expect(200);
    expect(
      (await http().get(`/patients/${FLORENCE_ID}/consents`).set(florence)).body.language,
    ).toBe('en');
    await http()
      .put(`/patients/${FLORENCE_ID}/language`)
      .set(florence)
      .send({ language: 'de' })
      .expect(400);
  });

  it('droit d’accès : le patient télécharge son dossier en PDF (sans résumé IA), pas celui d’un autre', async () => {
    const florence = await as(FLORENCE_ID, 'patient');
    const res = await http()
      .post(`/patients/${FLORENCE_ID}/export.pdf`)
      .set(florence)
      .send({ resume: ['Résumé IA non validé par le patient'] })
      .buffer()
      .parse(parser)
      .expect(200);
    const text = (res.body as Buffer).toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('Ngo Bassa');
    expect(text).not.toContain('Résumé IA non validé');
    await http()
      .post('/patients/00000000-0000-4000-8000-010000000002/export.pdf')
      .set(florence)
      .send({})
      .expect(403);
  });
});
