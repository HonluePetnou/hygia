import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TokenIssuer, localVerifier } from '@hygia/auth';
import { FLORENCE_ID, NANA_ID } from '@hygia/fhir';
import type { Role } from '@hygia/types';
import type { AuditEvent } from '@hygia/audit';
import request from 'supertest';
import { CLOCK, type Clock } from '../src/access/clock.js';
import { AppModule } from '../src/app.module.js';
import { TOKEN_VERIFIER } from '../src/auth/jwt-auth.guard.js';
import { EPIDEMIOLOGY_SOURCE, type EpidemiologyData } from '../src/exports/epidemiology-source.js';
import { toCsv } from '../src/exports/csv.js';

const TEAM_ID = '00000000-0000-4000-8000-040000000001';
const KAMGA_ID = '00000000-0000-4000-8000-020000000003';

class FakeClock implements Clock {
  now(): Date {
    return new Date('2026-11-05T09:00:00Z');
  }
}

const REPORT: EpidemiologyData = {
  week: '2026-W44',
  cases: [{ pathology: 'choléra', district: 'Mora', cases: 14 }],
  districts: [{ district: 'Mora', cases: 14, outbreak: true }],
  outbreaks: [{ pathology: 'choléra', district: 'Mora', cases: 14, expected: 3.2, threshold: 7.1 }],
};

const binary = (res: request.Response): string => (res.body as Buffer).toString('latin1');
const parser = (res: request.Response, done: (error: Error | null, body: Buffer) => void): void => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => done(null, Buffer.concat(chunks)));
};

describe('exports PDF et CSV (RF17)', () => {
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
      .overrideProvider(EPIDEMIOLOGY_SOURCE)
      .useValue({ load: () => Promise.resolve(REPORT) })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const pdf = (headers: Record<string, string>, id: string, body: object = {}) =>
    request(app.getHttpServer()).post(`/patients/${id}/export.pdf`).set(headers).send(body).buffer().parse(parser);

  it('exporte le dossier en PDF avec identité, traitements, résumé validé et pied de page', async () => {
    const nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    const res = await pdf(nana, FLORENCE_ID, { resume: ['Insuffisance cardiaque stable'] }).expect(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('dossier-HYG-2024-00871.pdf');
    const text = binary(res);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('Ngo Bassa');
    expect(text).toContain('Florence');
    expect(text).toContain('HYG-2024-00871');
    expect(text).toContain('Pénicilline'.replace('é', '\\351'));
    expect(text).toContain('Insuffisance cardiaque stable');
    expect(text).toContain('Document confidentiel');
    expect(text).toContain(NANA_ID);
    expect(text).toContain('page 1/');
  });

  it('exporte dans la langue demandée et omet le résumé non validé', async () => {
    const nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    const text = binary(await pdf(nana, FLORENCE_ID, { langue: 'en' }).expect(200));
    expect(text).toContain('Confidential document');
    expect(text).not.toContain('Summary validated');
    await pdf(nana, FLORENCE_ID, { langue: 'de' }).expect(400);
    await pdf(nana, FLORENCE_ID, { resume: 'texte' }).expect(400);
  });

  it('refuse l’export hors équipe, aux rôles non cliniques et sans jeton', async () => {
    await pdf(await as(KAMGA_ID, 'medecin'), FLORENCE_ID).expect(403);
    await pdf(await as('adm', 'admin'), FLORENCE_ID).expect(403);
    await pdf(await as(NANA_ID, 'medecin', [TEAM_ID]), 'inconnu').expect(404);
    await request(app.getHttpServer()).post(`/patients/${FLORENCE_ID}/export.pdf`).expect(401);
  });

  it('audite chaque export (action export)', async () => {
    const nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    await pdf(nana, FLORENCE_ID).expect(200);
    await request(app.getHttpServer())
      .post('/recherche/export.csv')
      .set(nana)
      .send({ filtres: [] })
      .expect(200);
    const log = (await request(app.getHttpServer()).get(`/patients/${FLORENCE_ID}/acces`).set(nana).expect(200))
      .body as AuditEvent[];
    const exports = log.filter((event) => event.action === 'export');
    expect(exports.map((event) => event.resourceType)).toEqual(['Dossier', 'ListePatients']);
    expect(exports[0]).toMatchObject({ actor: NANA_ID, reason: 'soins' });
  });

  it('exporte le résultat d’une recherche en CSV avec en-têtes, limité à l’équipe', async () => {
    const nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    const res = await request(app.getHttpServer())
      .post('/recherche/export.csv')
      .set(nana)
      .send({ requete: 'insuffisance cardiaque', langue: 'en' })
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = (res.text.replace('﻿', '')).trim().split('\r\n');
    expect(lines[0]).toBe('MRN,Family name,Given name,Sex,Date of birth,Age,Diagnoses,Last visit,Facility');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('HYG-2024-00871');

    const kamga = await as(KAMGA_ID, 'medecin');
    const empty = await request(app.getHttpServer()).post('/recherche/export.csv').set(kamga).send({ filtres: [] }).expect(200);
    expect(empty.text.replace('﻿', '').trim().split('\r\n')).toHaveLength(1);
    await request(app.getHttpServer()).post('/recherche/export.csv').set(await as('aud', 'auditeur')).send({ filtres: [] }).expect(403);
    await request(app.getHttpServer()).post('/recherche/export.csv').set(nana).send({}).expect(400);
  });

  it('exporte le rapport épidémiologique pour l’analyste uniquement, sans donnée identifiante', async () => {
    const res = await request(app.getHttpServer())
      .post('/analytique/rapport.pdf')
      .set(await as('ana', 'analyste'))
      .send({ langue: 'fr' })
      .buffer()
      .parse(parser)
      .expect(200);
    const text = binary(res);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('Mora');
    expect(text).toContain('pseudonymis');
    expect(text).not.toContain('Ngo Bassa');
    await request(app.getHttpServer()).post('/analytique/rapport.pdf').set(await as(NANA_ID, 'medecin', [TEAM_ID])).send({}).expect(403);
  });
});

describe('toCsv', () => {
  it('échappe les guillemets et neutralise les formules', () => {
    const csv = toCsv(['a', 'b'], [['x,"y"', '=1+1']]);
    expect(csv).toBe('﻿a,b\r\n"x,""y""",\'=1+1\r\n');
  });
});
