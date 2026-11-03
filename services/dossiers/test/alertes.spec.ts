import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TokenIssuer, localVerifier } from '@hygia/auth';
import { FLORENCE_ID, NANA_ID } from '@hygia/fhir';
import type { Role } from '@hygia/types';
import request from 'supertest';
import { CLOCK, type Clock } from '../src/access/clock.js';
import { ALERT_EVENTS, type InMemoryAlertEventPublisher } from '../src/alertes/alert-events.js';
import type { AlertRecord } from '../src/alertes/alert.js';
import { computePrecision } from '../src/alertes/precision.js';
import { AppModule } from '../src/app.module.js';
import { TOKEN_VERIFIER } from '../src/auth/jwt-auth.guard.js';

const TEAM_ID = '00000000-0000-4000-8000-040000000001';
const KAMGA_ID = '00000000-0000-4000-8000-020000000003';

class FakeClock implements Clock {
  current = new Date('2026-11-05T09:00:00Z');
  now(): Date {
    return this.current;
  }
}

type Alert = AlertRecord & { precision?: { accepted: number; decided: number; rate: number | null } };

describe('précision des agents (fonction pure)', () => {
  const decided = (agent: AlertRecord['agent'], status: AlertRecord['decision']['status'], at: string) =>
    ({ agent, decision: { status, decidedAt: at } }) as AlertRecord;
  const now = new Date('2026-11-05T09:00:00Z');

  it('compte acceptées / décidées sur 30 jours, ignore les alertes ouvertes et trop anciennes', () => {
    const alerts = [
      decided('pharmacovigilance', 'accepted', '2026-11-01T10:00:00Z'),
      decided('pharmacovigilance', 'accepted_notified', '2026-10-20T10:00:00Z'),
      decided('pharmacovigilance', 'accepted', '2026-10-10T10:00:00Z'),
      decided('pharmacovigilance', 'rejected', '2026-11-02T10:00:00Z'),
      decided('pharmacovigilance', 'accepted', '2026-09-01T10:00:00Z'), // hors fenêtre
      { agent: 'pharmacovigilance', decision: { status: 'pending' } } as AlertRecord,
      decided('quality', 'rejected', '2026-11-03T10:00:00Z'),
    ];
    const precision = computePrecision(alerts, now);
    expect(precision.find((p) => p.agent === 'pharmacovigilance')).toEqual({
      agent: 'pharmacovigilance',
      accepted: 3,
      decided: 4,
      rate: 0.75,
    });
    expect(precision.find((p) => p.agent === 'quality')?.rate).toBe(0);
    expect(precision.find((p) => p.agent === 'triage')).toEqual({ agent: 'triage', accepted: 0, decided: 0, rate: null });
  });
});

describe('alertes IA (RF18)', () => {
  let app: INestApplication;
  let issuer: TokenIssuer;
  let clock: FakeClock;
  let nana: Record<string, string>;
  let kamga: Record<string, string>;
  let auditeur: Record<string, string>;
  let admin: Record<string, string>;
  let events: InMemoryAlertEventPublisher;

  async function as(sub: string, role: Role, teams: string[] = []): Promise<Record<string, string>> {
    const { token } = await issuer.issue({ sub, role, teams, emergency: [] }, clock.now());
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
    await app.init();
    events = app.get(ALERT_EVENTS);
    nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    kamga = await as(KAMGA_ID, 'medecin');
    auditeur = await as('aud', 'auditeur');
    admin = await as('agents', 'admin');
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const open = async (): Promise<Alert[]> => (await http().get('/alertes?statut=ouvertes').set(nana).expect(200)).body as Alert[];
  const decide = (id: string, body: Record<string, unknown>, who = nana) =>
    http().post(`/alertes/${id}/decision`).set(who).send(body);

  it('liste les alertes ouvertes, filtrables par statut, refuse les rôles non cliniques', async () => {
    const alerts = await open();
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((a) => a.decision.status === 'pending')).toBe(true);
    expect(alerts[0]?.patientId).toBe(FLORENCE_ID);
    expect((await http().get('/alertes?statut=rejetees').set(nana).expect(200)).body).toEqual([]);
    await http().get('/alertes?statut=nimporte').set(nana).expect(400);
    await http().get('/alertes').set(auditeur).expect(403);
    await http().get('/alertes').expect(401);
    expect((await http().get('/alertes').set(kamga).expect(200)).body).toEqual([]);
  });

  it('GET /alertes/:id renvoie le raisonnement numéroté, les sources et la précision de l’agent', async () => {
    const [first] = await open();
    const res = await http().get(`/alertes/${first?.id}`).set(nana).expect(200);
    const alert = res.body as Alert;
    expect(alert.reasoning.map((s) => s.step)).toEqual([1, 2, 3, 4]);
    expect(alert.sources.length).toBeGreaterThan(0);
    expect(alert.precision).toMatchObject({ decided: 0, rate: null });
    await http().get('/alertes/00000000-0000-4000-8000-ffffffffffff').set(nana).expect(404);
    await http().get(`/alertes/${first?.id}`).set(kamga).expect(403);
  });

  it('refuse un rejet sans justification (ou vide) et garde l’alerte ouverte', async () => {
    const [first] = await open();
    await decide(first?.id as string, { decision: 'rejeter' }).expect(400);
    await decide(first?.id as string, { decision: 'rejeter', justification: '   ' }).expect(400);
    await decide(first?.id as string, { decision: 'peut-etre' }).expect(400);
    expect((await open()).map((a) => a.id)).toContain(first?.id);
    await decide(first?.id as string, { decision: 'rejeter', justification: 'déjà prévenue' }).expect(200);
  });

  it('calcule la précision de l’agent : acceptées / décidées', async () => {
    const pharmaco = (await open()).filter((a) => a.agent === 'pharmacovigilance');
    expect(pharmaco.length).toBeGreaterThanOrEqual(2);
    await decide(pharmaco[0]?.id as string, { decision: 'accepter' }).expect(200);
    const res = await decide(pharmaco[1]?.id as string, { decision: 'rejeter', justification: 'faux positif' }).expect(200);
    expect((res.body as Alert).precision).toEqual({ agent: 'pharmacovigilance', accepted: 1, decided: 2, rate: 0.5 });
    const all = (await http().get('/alertes/precision').set(nana).expect(200)).body as { agent: string; rate: number | null }[];
    expect(all.find((p) => p.agent === 'pharmacovigilance')?.rate).toBe(0.5);
    expect(all.find((p) => p.agent === 'quality')?.rate).toBeNull();
  });

  it('« accepter et notifier » publie un événement pour le service Notification, pas « accepter seulement »', async () => {
    const [first, second] = await open();
    await decide(first?.id as string, { decision: 'accepter' }).expect(200);
    expect(events.published).toHaveLength(0);
    const res = await decide(second?.id as string, { decision: 'accepter_notifier' }).expect(200);
    expect((res.body as Alert).decision).toMatchObject({ status: 'accepted_notified', decidedBy: NANA_ID });
    expect(events.published).toEqual([
      expect.objectContaining({ type: 'alerte.notification', alertId: second?.id, requestedBy: NANA_ID }),
    ]);
    const accepted = (await http().get('/alertes?statut=acceptees').set(nana).expect(200)).body as Alert[];
    expect(accepted.map((a) => a.id).sort()).toEqual([first?.id, second?.id].sort());
  });

  it('enregistre seulement la décision : le dossier du patient est inchangé, et une alerte ne se décide qu’une fois', async () => {
    const [first] = await open();
    const before = (await http().get(`/patients/${first?.patientId}`).set(nana).expect(200)).body;
    await decide(first?.id as string, { decision: 'accepter' }).expect(200);
    await decide(first?.id as string, { decision: 'rejeter', justification: 'x' }).expect(409);
    const after = (await http().get(`/patients/${first?.patientId}`).set(nana).expect(200)).body;
    expect(after).toEqual(before);
    const stored = (await http().get(`/alertes/${first?.id}`).set(nana).expect(200)).body as Alert;
    expect(stored.version).toBe(2);
  });

  it('audite les lectures et les décisions dans le dossier du patient', async () => {
    const [first] = await open();
    await decide(first?.id as string, { decision: 'rejeter', justification: 'x' }).expect(200);
    const log = await http().get(`/patients/${first?.patientId}/acces`).set(nana).expect(200);
    const text = JSON.stringify(log.body);
    expect(text).toContain('décision sur alerte IA : rejeter');
    expect(text).toContain('consultation des alertes IA');
  });

  it('un médecin hors équipe ne peut pas décider', async () => {
    const [first] = await open();
    await decide(first?.id as string, { decision: 'accepter' }, kamga).expect(403);
  });

  it('POST /alertes : un agent (compte de service) dépose une alerte, sans doublon', async () => {
    const issue = {
      id: '00000000-0000-4000-8000-0a0000009900',
      subject: { reference: `Patient/${FLORENCE_ID}` },
      agent: 'triage',
      severity: 'low',
      title: 'Document à vérifier',
      reasoning: [{ step: 1, text: 'Rattachement automatique' }],
      sources: [],
      proposal: 'Vérifier le rattachement',
    };
    await http().post('/alertes').set(nana).send(issue).expect(403);
    await http().post('/alertes').set(admin).send({ ...issue, severity: 'extreme' }).expect(400);
    await http().post('/alertes').set(admin).send(issue).expect(201);
    await http().post('/alertes').set(admin).send(issue).expect(201);
    const ids = (await open()).filter((a) => a.id === issue.id);
    expect(ids).toHaveLength(1);
    expect(ids[0]?.decision.status).toBe('pending');
  });
});
