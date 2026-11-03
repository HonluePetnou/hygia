import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TokenIssuer, localVerifier } from '@hygia/auth';
import { FLORENCE_ID, NANA_ID } from '@hygia/fhir';
import type { Role } from '@hygia/types';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { TOKEN_VERIFIER } from '../src/auth/jwt-auth.guard.js';

const TEAM_ID = '00000000-0000-4000-8000-040000000001';
const ICD = 'http://hl7.org/fhir/sid/icd-10';

const body = {
  observations: [
    {
      code: { system: 'http://loinc.org', code: '8480-6', display: 'TA systolique' },
      value: 162,
      unit: 'mmHg',
    },
  ],
  conditions: [{ system: ICD, code: 'I10', display: 'Hypertension essentielle' }],
  prescriptions: [
    {
      medication: { system: 'http://www.whocc.no/atc', code: 'C08CA01', display: 'Amlodipine' },
      doseValue: 10,
      doseUnit: 'mg',
      timesPerDay: 1,
    },
  ],
};

describe('consultations validées (scribe)', () => {
  let app: INestApplication;
  let issuer: TokenIssuer;

  const as = async (sub: string, role: Role, teams: string[] = []) => ({
    authorization: `Bearer ${(await issuer.issue({ sub, role, teams, emergency: [] }, new Date())).token}`,
  });

  beforeEach(async () => {
    issuer = await TokenIssuer.create();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(localVerifier(issuer.jwks()))
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('crée les ressources en version 1 et elles apparaissent dans le dossier', async () => {
    const nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    const res = await http()
      .post(`/patients/${FLORENCE_ID}/consultations`)
      .set(nana)
      .send(body)
      .expect(201);
    expect(res.body.encounter).toMatchObject({ version: 1, encounterClass: 'ambulatory' });
    expect(res.body.conditions[0]).toMatchObject({ version: 1, code: { code: 'I10' } });
    expect(res.body.medicationRequests[0].requester.reference).toBe(`Practitioner/${NANA_ID}`);
    const timeline = await http().get(`/patients/${FLORENCE_ID}/chronologie`).set(nana).expect(200);
    expect(JSON.stringify(timeline.body)).toContain('Amlodipine');
  });

  it('refuse un infirmier, un médecin hors équipe et un corps vide ou invalide', async () => {
    const nurse = await as(NANA_ID, 'infirmier', [TEAM_ID]);
    const outsider = await as('00000000-0000-4000-8000-020000000003', 'medecin');
    const nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    const url = `/patients/${FLORENCE_ID}/consultations`;
    await http().post(url).set(nurse).send(body).expect(403);
    await http().post(url).set(outsider).send(body).expect(403);
    await http().post(url).send(body).expect(401);
    await http().post(url).set(nana).send({}).expect(400);
    await http()
      .post(url)
      .set(nana)
      .send({ ...body, prescriptions: [{ medication: {}, doseValue: 1 }] })
      .expect(400);
    await http()
      .post('/patients/00000000-0000-4000-8000-ffffffffffff/consultations')
      .set(nana)
      .send(body)
      .expect(404);
  });
});
