import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TokenIssuer, localVerifier } from '@hygia/auth';
import { demoDataset, FLORENCE_DOUBLON_ID, FLORENCE_ID, NANA_ID } from '@hygia/fhir';
import type { Patient, Role } from '@hygia/types';
import request from 'supertest';
import { CLOCK, type Clock } from '../src/access/clock.js';
import { AppModule } from '../src/app.module.js';
import { TOKEN_VERIFIER } from '../src/auth/jwt-auth.guard.js';
import { compare, normalizeText } from '../src/doublons/similarity.js';

const TEAM_ID = '00000000-0000-4000-8000-040000000001';
const KAMGA_ID = '00000000-0000-4000-8000-020000000003';

class FakeClock implements Clock {
  current = new Date('2026-11-05T09:00:00Z');
  now(): Date {
    return this.current;
  }
}

const patientById = (id: string): Patient => demoDataset.patients.find((p) => p.id === id) as Patient;

describe('score de similarité', () => {
  const florence = patientById(FLORENCE_ID);
  const doublon = patientById(FLORENCE_DOUBLON_ID);

  it('normalise accents, casse et ponctuation', () => {
    expect(normalizeText('  Ngo-BASSA  Éloïse ')).toBe('ngo bassa eloise');
  });

  it('atteint au moins 90 % pour le doublon de Florence (nom inversé, téléphone décalé)', () => {
    const { score, criteria } = compare(florence, doublon);
    expect(score).toBeGreaterThanOrEqual(0.9);
    expect(criteria.name).toBe(1);
    expect(criteria.birthDate).toBe(1);
    expect(criteria.phone).toBeLessThan(1);
  });

  it('est symétrique et ignore l’ordre des mots, la casse et les accents', () => {
    const other = { ...doublon, givenName: 'FLORÈNCE', familyName: 'bassa ngo' };
    expect(compare(florence, other).score).toBe(compare(other, florence).score);
    expect(compare(florence, other).criteria.name).toBeGreaterThan(0.85);
  });

  it('reste faible pour deux patients différents', () => {
    expect(compare(florence, patientById(demoDataset.patients[1]?.id as string)).score).toBeLessThan(0.5);
  });

  it('ignore un critère manquant et renormalise les poids', () => {
    const withoutPhone: Patient = { ...doublon };
    delete withoutPhone.phone;
    const { score, criteria } = compare(florence, withoutPhone);
    expect(criteria.phone).toBeNull();
    expect(score).toBe(1);
  });

  it('pénalise une date de naissance différente', () => {
    const { score } = compare(florence, { ...doublon, birthDate: '1960-01-01' });
    expect(score).toBeLessThan(0.8);
  });
});

describe('doublons et fusion (RF4)', () => {
  let app: INestApplication;
  let issuer: TokenIssuer;
  let clock: FakeClock;
  let nana: Record<string, string>;
  let kamga: Record<string, string>;
  let auditeur: Record<string, string>;

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
    nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    kamga = await as(KAMGA_ID, 'medecin');
    auditeur = await as('aud', 'auditeur');
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const fusion = (a: string, b: string) => `/patients/${a}/fusion/${b}`;

  /** Chronologie du patient (consultations, mesures, prescriptions, documents). */
  async function timelineOf(id: string): Promise<TimelineLike[]> {
    const res = await http().get(`/patients/${id}/chronologie`).set(nana).expect(200);
    return res.body as TimelineLike[];
  }
  type TimelineLike = { id?: string; type?: string; resourceId?: string };

  it('GET /doublons propose la paire de Florence avec un score ≥ 90 %', async () => {
    const res = await http().get('/doublons').set(nana).expect(200);
    expect(res.body).toHaveLength(1);
    const [pair] = res.body as { score: number; a: Patient; b: Patient; id: string }[];
    expect(pair?.score).toBeGreaterThanOrEqual(0.9);
    expect([pair?.a.id, pair?.b.id].sort()).toEqual([FLORENCE_ID, FLORENCE_DOUBLON_ID].sort());
    expect(pair?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('refuse les rôles non cliniques et les médecins hors équipe ne voient rien', async () => {
    await http().get('/doublons').set(auditeur).expect(403);
    const res = await http().get('/doublons').set(kamga).expect(200);
    expect(res.body).toEqual([]);
    await http().post(fusion(FLORENCE_ID, FLORENCE_DOUBLON_ID)).set(kamga).send({ motif: 'x' }).expect(403);
  });

  it('le seuil est lu et validé dans l’environnement', async () => {
    const { loadEnv } = await import('../src/config/env.js');
    expect(loadEnv({ DOSSIERS_SEUIL_DOUBLONS: '0.99' }).duplicateThreshold).toBe(0.99);
    expect(() => loadEnv({ DOSSIERS_SEUIL_DOUBLONS: '2' })).toThrow(/DOSSIERS_SEUIL_DOUBLONS/);
  });

  it('POST /doublons/:id/ignorer retire la paire et est audité', async () => {
    const list = await http().get('/doublons').set(nana).expect(200);
    const id = (list.body as { id: string }[])[0]?.id as string;
    await http().post(`/doublons/${id}/ignorer`).set(nana).expect(200);
    expect((await http().get('/doublons').set(nana).expect(200)).body).toEqual([]);
    await http().post(`/doublons/${id}/ignorer`).set(nana).expect(404);
    const log = await http().get(`/patients/${FLORENCE_ID}/acces`).set(nana).expect(200);
    expect(JSON.stringify(log.body)).toContain('doublon ignoré');
  });

  it('fusionne sans perte : tout est rattaché au dossier conservé, l’autre est marqué fusionné', async () => {
    const before = [...(await timelineOf(FLORENCE_ID)), ...(await timelineOf(FLORENCE_DOUBLON_ID))];
    const res = await http()
      .post(fusion(FLORENCE_ID, FLORENCE_DOUBLON_ID))
      .set(nana)
      .send({ motif: 'même patiente', choix: { phone: 'b' }, versions: { a: 1, b: 1 } })
      .expect(201);
    expect(res.body.moved).toMatchObject({ encounters: 1, observations: 1 });
    expect(res.body.kept.phone).toBe('+237 699 12 34 56');
    expect(res.body.kept.version).toBe(2);
    expect(res.body.merged.mergedInto).toBe(FLORENCE_ID);

    const after = await timelineOf(FLORENCE_ID);
    expect(after).toHaveLength(before.length);
    // Le dossier fusionné n'a plus de contenu : il n'ouvre plus d'accès par lui-même.
    await http().get(`/patients/${FLORENCE_DOUBLON_ID}/chronologie`).set(nana).expect(403);

    const search = await http().get('/patients?q=Florence').set(nana).expect(200);
    expect((search.body as Patient[]).map((p) => p.id)).toEqual([FLORENCE_ID]);
    expect((await http().get('/doublons').set(nana).expect(200)).body).toEqual([]);
  });

  it('applique le choix champ par champ', async () => {
    const res = await http()
      .post(fusion(FLORENCE_ID, FLORENCE_DOUBLON_ID))
      .set(nana)
      .send({ motif: 'même patiente', choix: { familyName: 'b' } })
      .expect(201);
    expect(res.body.kept.familyName).toBe('BASSA NGO');
    expect(res.body.kept.givenName).toBe('Florence');
    expect(res.body.kept.ipp).toBe('HYG-2024-00871');
  });

  it('valide la demande : motif, choix, versions, dossiers distincts, dossier inconnu, déjà fusionné', async () => {
    const url = fusion(FLORENCE_ID, FLORENCE_DOUBLON_ID);
    await http().post(url).set(nana).send({}).expect(400);
    await http().post(url).set(nana).send({ motif: 'x', choix: { phone: 'c' } }).expect(400);
    await http().post(url).set(nana).send({ motif: 'x', choix: { inconnu: 'a' } }).expect(400);
    await http().post(url).set(nana).send({ motif: 'x', versions: { a: 1, b: 9 } }).expect(409);
    await http().post(fusion(FLORENCE_ID, FLORENCE_ID)).set(nana).send({ motif: 'x' }).expect(400);
    await http().post(fusion(FLORENCE_ID, KAMGA_ID)).set(nana).send({ motif: 'x' }).expect(404);
    await http().post(url).set(nana).send({ motif: 'x' }).expect(201);
    await http().post(url).set(nana).send({ motif: 'x' }).expect(409);
  });

  it('annule la fusion : ressources et fiches restituées, versions conservées', async () => {
    const before = [await timelineOf(FLORENCE_ID), await timelineOf(FLORENCE_DOUBLON_ID)];
    const done = await http()
      .post(fusion(FLORENCE_ID, FLORENCE_DOUBLON_ID))
      .set(nana)
      .send({ motif: 'même patiente', choix: { familyName: 'b' } })
      .expect(201);
    const undone = await http().post(`/fusions/${done.body.id}/annuler`).set(nana).expect(200);
    expect(undone.body.undone).toBe(true);
    expect(undone.body.kept.familyName).toBe('Ngo Bassa');
    expect(undone.body.merged.mergedInto).toBeUndefined();

    expect([await timelineOf(FLORENCE_ID), await timelineOf(FLORENCE_DOUBLON_ID)]).toEqual(before);
    expect((await http().get('/doublons').set(nana).expect(200)).body).toHaveLength(1);
    await http().post(`/fusions/${done.body.id}/annuler`).set(nana).expect(409);
    await http().post('/fusions/inconnue/annuler').set(nana).expect(404);

    const versions = await http().get(`/patients/${FLORENCE_ID}/versions`).set(nana).expect(200);
    const reasons = (versions.body as { reason: string }[]).map((v) => v.reason);
    expect(reasons).toContain('annulation de la fusion');
    expect(reasons).toContain('fusion : même patiente');
  });

  it('refuse l’annulation si une fiche a été modifiée depuis la fusion', async () => {
    const done = await http().post(fusion(FLORENCE_ID, FLORENCE_DOUBLON_ID)).set(nana).send({ motif: 'x' }).expect(201);
    await http()
      .patch(`/patients/${FLORENCE_ID}`)
      .set(nana)
      .set('If-Match', '2')
      .send({ givenName: 'Flo', motif: 'retouche' })
      .expect(200);
    await http().post(`/fusions/${done.body.id}/annuler`).set(nana).expect(409);
  });

  it('audite la fusion et son annulation sur les deux dossiers', async () => {
    const done = await http().post(fusion(FLORENCE_ID, FLORENCE_DOUBLON_ID)).set(nana).send({ motif: 'doublon avéré' }).expect(201);
    await http().post(`/fusions/${done.body.id}/annuler`).set(nana).expect(200);
    for (const id of [FLORENCE_ID, FLORENCE_DOUBLON_ID]) {
      const log = await http().get(`/patients/${id}/acces`).set(auditeur).expect(200);
      const events = (log.body as { action: string; reason: string; actor: string }[]).filter(
        (e) => e.action === 'modification',
      );
      expect(events.map((e) => e.reason).join('|')).toMatch(/fusion/);
      expect(events.map((e) => e.reason).join('|')).toMatch(/annulation/);
      expect(events.every((e) => e.actor === NANA_ID)).toBe(true);
    }
  });
});
