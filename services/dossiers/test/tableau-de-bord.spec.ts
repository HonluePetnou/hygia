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
import { ENV } from '../src/config/env-token.js';
import { loadEnv } from '../src/config/env.js';

const KAMGA_ID = '00000000-0000-4000-8000-020000000003';
const TEAM_ID = '00000000-0000-4000-8000-040000000001';
const NOW = new Date('2026-11-05T09:00:00Z');

class FakeClock implements Clock {
  now(): Date {
    return NOW;
  }
}

describe('synthèse du dossier et tableau de bord', () => {
  let app: INestApplication;
  let issuer: TokenIssuer;

  async function as(
    sub: string,
    role: Role,
    teams: string[] = [],
  ): Promise<Record<string, string>> {
    const { token } = await issuer.issue({ sub, role, teams, emergency: [] }, NOW);
    return { authorization: `Bearer ${token}` };
  }

  async function start(dashboardDate?: string): Promise<void> {
    issuer = await TokenIssuer.create();
    const env = { ...loadEnv({}), ...(dashboardDate ? { dashboardDate } : {}) };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLOCK)
      .useValue(new FakeClock())
      .overrideProvider(ENV)
      .useValue(env)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(localVerifier(issuer.jwks(), () => NOW))
      .compile();
    app = module.createNestApplication();
    await app.init();
  }

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('synthèse : allergies, anticoagulant, interaction signalée et équipe de soins', async () => {
    await start();
    const nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    const body = (await http().get(`/patients/${FLORENCE_ID}/synthese`).set(nana).expect(200)).body;
    expect(body.gender).toBe('female');
    expect(body.allergies).toEqual(expect.arrayContaining([expect.stringMatching(/nicilline/i)]));
    expect(body.anticoagulant).toBe(true);
    const flagged = body.treatments.filter((t: { flagged: boolean }) => t.flagged);
    expect(flagged).toHaveLength(2);
    expect(body.vitals.length).toBeGreaterThan(0);
    expect(body.careTeam).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: NANA_ID })]),
    );
  });

  it('synthèse : 403 hors équipe de soins ou sans rôle clinique, et lecture auditée', async () => {
    await start();
    await http()
      .get(`/patients/${FLORENCE_ID}/synthese`)
      .set(await as(KAMGA_ID, 'medecin'))
      .expect(403);
    await http()
      .get(`/patients/${FLORENCE_ID}/synthese`)
      .set(await as('root', 'admin'))
      .expect(403);
    await http().get(`/patients/${FLORENCE_ID}/synthese`).expect(401);

    const nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    await http().get(`/patients/${FLORENCE_ID}/synthese`).set(nana).expect(200);
    const log = (await http().get(`/patients/${FLORENCE_ID}/acces`).set(nana).expect(200)).body;
    expect(log).toEqual(
      expect.arrayContaining([expect.objectContaining({ actor: NANA_ID, action: 'lecture' })]),
    );
  });

  it('tableau de bord : consultation du jour de démonstration, alertes et documents', async () => {
    await start('2026-10-28');
    const nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    const body = (await http().get('/tableau-de-bord').set(nana).expect(200)).body;
    expect(body.consultations).toEqual([
      expect.objectContaining({ patientId: FLORENCE_ID, status: 'alert' }),
    ]);
    expect(body.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ patientId: FLORENCE_ID, kind: 'interaction', severity: 'high' }),
      ]),
    );
    expect(body.documentsImported).toBeGreaterThan(0);
    expect(body.documentsInProgress.length).toBeLessThanOrEqual(3);
    expect(body.weekActivity).toHaveLength(7);
  });

  it('tableau de bord : rien hors équipe, 403 sans rôle clinique, jour courant par défaut', async () => {
    await start();
    const kamga = (
      await http()
        .get('/tableau-de-bord')
        .set(await as(KAMGA_ID, 'medecin'))
        .expect(200)
    ).body;
    expect(kamga.consultations).toEqual([]);
    expect(kamga.alerts).toEqual([]);
    await http()
      .get('/tableau-de-bord')
      .set(await as('root', 'admin'))
      .expect(403);
    // Sans date de démonstration, le jour est celui de l'horloge (5 novembre) : aucune consultation.
    const nana = (
      await http()
        .get('/tableau-de-bord')
        .set(await as(NANA_ID, 'medecin', [TEAM_ID]))
        .expect(200)
    ).body;
    expect(nana.consultations).toEqual([]);
    expect(nana.alerts.length).toBeGreaterThan(0);
  });

  it('DOSSIERS_DATE_DEMO est validée au démarrage', () => {
    expect(loadEnv({ DOSSIERS_DATE_DEMO: '2026-10-28' }).dashboardDate).toBe('2026-10-28');
    expect(() => loadEnv({ DOSSIERS_DATE_DEMO: '28/10/2026' })).toThrow(/DOSSIERS_DATE_DEMO/);
  });
});
