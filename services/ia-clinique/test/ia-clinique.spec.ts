import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditLog, InMemoryAuditStore } from '@hygia/audit';
import { TokenIssuer, localVerifier } from '@hygia/auth';
import type { Role } from '@hygia/types';
import { FLORENCE_ID, NANA_ID } from '@hygia/fhir';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { TOKEN_VERIFIER } from '../src/auth/jwt-auth.guard.js';
import { AUDIT_LOG } from '../src/copilote/copilote.service.js';
import { WORD_DELAY_MS } from '../src/copilote/sse.js';
import { loadEnv } from '../src/config/env.js';
import { detectLanguage } from '../src/index/text.js';
import { CLINICAL_LANGUAGE_MODEL } from '../src/model/clinical-language-model.js';
import { MockClinicalLanguageModel } from '../src/model/mock-clinical-language-model.js';

const KAMGA_ID = '00000000-0000-4000-8000-020000000003';
const TEAM_ID = '00000000-0000-4000-8000-040000000001';
let nana: Record<string, string>;
let kamga: Record<string, string>;
let admin: Record<string, string>;
let verifier: ReturnType<typeof localVerifier>;

describe('service IA clinique', () => {
  let app: INestApplication;
  let audit: AuditLog;

  beforeEach(async () => {
    audit = new AuditLog(new InMemoryAuditStore());
    const issuer = await TokenIssuer.create();
    const as = async (sub: string, role: Role, teams: string[] = []) => ({
      authorization: `Bearer ${(await issuer.issue({ sub, role, teams, emergency: [] }, new Date())).token}`,
    });
    nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    kamga = await as(KAMGA_ID, 'medecin');
    admin = await as('root', 'admin');
    verifier = localVerifier(issuer.jwks());
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUDIT_LOG)
      .useValue(audit)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(verifier)
      .overrideProvider(WORD_DELAY_MS)
      .useValue(0)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const ask = (question: string, headers = nana) =>
    http().post(`/copilote/${FLORENCE_ID}`).set(headers).send({ question });

  it('401 sans jeton, 403 hors équipe ou pour un rôle non clinique, 404 patient inconnu', async () => {
    await http().post(`/copilote/${FLORENCE_ID}`).send({ question: 'ibuprofène' }).expect(401);
    await ask('ibuprofène', kamga).expect(403);
    await ask('ibuprofène', admin).expect(403);
    await http()
      .post('/copilote/00000000-0000-4000-8000-ffffffffffff')
      .set(nana)
      .send({ question: 'ibuprofène' })
      .expect(404);
  });

  it('400 pour une question vide', async () => {
    await ask('   ').expect(400);
    await http().post(`/copilote/${FLORENCE_ID}`).set(nana).send({}).expect(400);
  });

  it('la question sur l’ibuprofène cite l’ordonnance du 28/10', async () => {
    const res = await ask('Florence prend-elle de l’ibuprofène ?').expect(200);
    expect(res.body.language).toBe('fr');
    expect(res.body.answer).toContain('Ibuprofène 400 mg');
    const ordonnance = res.body.sources.find(
      (s: { titre: string }) => s.titre === 'Ordonnance du 28 octobre 2026',
    );
    expect(ordonnance).toMatchObject({ date: '2026-10-28', n: 1 });
    expect(ordonnance.extrait).toContain('Ibuprofène');
    expect(res.body.answer).toContain('[1]');
  });

  it('une question en anglais sur l’échographie répond en anglais et cite le compte rendu', async () => {
    const res = await ask('What did the echocardiography show?').expect(200);
    expect(res.body.language).toBe('en');
    expect(res.body.answer.startsWith('According to the record:')).toBe(true);
    expect(res.body.answer).toContain('45%');
    expect(res.body.sources.length).toBeGreaterThan(0);
    for (const source of res.body.sources) {
      expect(source.titre).toBe('Echocardiography report (LVEF 45%)');
    }
  });

  it('une question hors sujet ne donne aucune source', async () => {
    const res = await ask('Quelle est la capitale du Japon ?').expect(200);
    expect(res.body).toEqual({
      answer: 'Aucune source du dossier ne permet de répondre.',
      language: 'fr',
      sources: [],
    });
    const en = await ask('What is the capital of Japan?').expect(200);
    expect(en.body.answer).toBe('No source in the record allows an answer.');
    expect(en.body.sources).toEqual([]);
  });

  it('toute réponse non vide a au moins une source, numérotée comme ses marqueurs', async () => {
    const questions = ['INR warfarine', 'insuffisance cardiaque', 'pénicilline', 'ordonnance', 'xyzzy'];
    for (const question of questions) {
      const { body } = await ask(question).expect(200);
      if (body.sources.length === 0) {
        expect(body.answer).toBe('Aucune source du dossier ne permet de répondre.');
        continue;
      }
      for (const source of body.sources) expect(body.answer).toContain(`[${source.n}]`);
    }
  });

  it('refuse toute réponse sans marqueur de source valide, même venant du modèle', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLINICAL_LANGUAGE_MODEL)
      .useValue({ generate: async () => 'Réponse inventée sans source.' })
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(verifier)
      .compile();
    const other = module.createNestApplication();
    await other.init();
    const res = await request(other.getHttpServer())
      .post(`/copilote/${FLORENCE_ID}`)
      .set(nana)
      .send({ question: 'ibuprofène' })
      .expect(200);
    expect(res.body.sources).toEqual([]);
    expect(res.body.answer).toBe('Aucune source du dossier ne permet de répondre.');
    await other.close();
  });

  it('mode dégradé : modèle déclaré indisponible par le broker → recherche simple, passages cités, sans erreur', async () => {
    const res = await ask('Florence prend-elle de l’ibuprofène ?').set('x-hygia-fault', 'llm-unavailable').expect(200);
    expect(res.body.degraded).toBe(true);
    expect(res.body.answer).toContain('Mode dégradé : recherche simple');
    expect(res.body.sources.length).toBeGreaterThan(0);
    for (const source of res.body.sources) expect(res.body.answer).toContain(`[${source.n}] ${source.extrait}`);
    const normal = await ask('Florence prend-elle de l’ibuprofène ?').expect(200);
    expect(normal.body.degraded).toBeUndefined();
  });

  it('mode dégradé : le modèle lève une erreur → recherche simple au lieu d’un 500 ; sans passage, aucune source', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLINICAL_LANGUAGE_MODEL)
      .useValue({ generate: async () => Promise.reject(new Error('Bedrock indisponible')) })
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(verifier)
      .compile();
    const other = module.createNestApplication();
    await other.init();
    const post = (question: string) =>
      request(other.getHttpServer()).post(`/copilote/${FLORENCE_ID}`).set(nana).send({ question });
    const res = await post('ibuprofène').expect(200);
    expect(res.body).toMatchObject({ degraded: true });
    expect(res.body.sources.length).toBeGreaterThan(0);
    const none = await post('zzzz qqqq').expect(200);
    expect(none.body.sources).toEqual([]);
    await other.close();
  });

  it('expose /health et /metrics (requêtes, erreurs, p50/p95)', async () => {
    await ask('ibuprofène').expect(200);
    expect((await http().get('/health').expect(200)).body).toEqual({ status: 'ok', service: 'ia-clinique' });
    const metrics = (await http().get('/metrics').expect(200)).body;
    expect(metrics).toMatchObject({ service: 'ia-clinique', requests: 1, errors: 0 });
    expect(metrics.latency).toEqual(expect.objectContaining({ p50Ms: expect.any(Number), p95Ms: expect.any(Number) }));
    const res = await http().get('/health').set('x-correlation-id', 'corr-1').expect(200);
    expect(res.headers['x-correlation-id']).toBe('corr-1');
  });

  it('audite chaque question (question_copilote) sans écrire la question', async () => {
    await ask('ibuprofène').expect(200);
    await ask('capitale du Japon').expect(200);
    const events = audit.forPatient(FLORENCE_ID).filter((e) => e.action === 'question_copilote');
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ actor: NANA_ID, role: 'medecin', patientId: FLORENCE_ID });
    expect(JSON.stringify(events)).not.toContain('ibuprofène');
    expect(audit.verify()).toEqual({ intact: true });
  });

  it('flux SSE : mots au fil de l’eau, puis sources et fin', async () => {
    const res = await http()
      .get(`/copilote/${FLORENCE_ID}/flux`)
      .query({ q: 'ibuprofène' })
      .set(nana)
      .buffer(true)
      .parse((response, callback) => {
        let data = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (data += chunk));
        response.on('end', () => callback(null, data));
      })
      .expect(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    const text = res.body as unknown as string;
    const words = [...text.matchAll(/event: word\ndata: (.*)\n/g)].map(
      (m) => (JSON.parse(m[1] ?? '{}') as { word: string }).word,
    );
    expect(words.join(' ')).toContain('Ibuprofène 400 mg');
    expect(text).toContain('event: sources');
    expect(text.trimEnd().endsWith('event: done\ndata: {}')).toBe(true);
    expect(audit.forPatient(FLORENCE_ID).some((e) => e.action === 'question_copilote')).toBe(true);
  });

  it('flux SSE : 403 hors équipe, 400 sans question', async () => {
    await http().get(`/copilote/${FLORENCE_ID}/flux`).query({ q: 'x' }).set(kamga).expect(403);
    await http().get(`/copilote/${FLORENCE_ID}/flux`).set(nana).expect(400);
  });

  it('résumé : antécédents, traitements, résultats et alertes, chacun avec ses sources', async () => {
    const res = await http().get(`/patients/${FLORENCE_ID}/resume`).set(nana).expect(200);
    const { body } = res;
    expect(body.generatedByAi).toBe(true);
    expect(body.titres.antecedents).toBe('Antécédents');
    expect(body.antecedents.map((i: { texte: string }) => i.texte)).toEqual([
      'Fibrillation auriculaire (depuis le 2022-05-10)',
      'Insuffisance cardiaque (depuis le 2026-03-02)',
    ]);
    expect(body.traitements).toHaveLength(2);
    expect(body.resultats[0].texte).toBe('INR : 2.8 ratio (2026-10-14)');
    expect(body.resultats[1].texte).toContain('FEVG');
    const texts = body.alertes.map((i: { texte: string }) => i.texte).join('|');
    expect(texts).toContain('Pénicilline');
    expect(texts).toContain('Warfarine et Ibuprofène');
    for (const section of ['antecedents', 'traitements', 'resultats', 'alertes']) {
      for (const item of body[section]) expect(item.sources.length).toBeGreaterThan(0);
    }
    const interaction = body.alertes.find((i: { texte: string }) => i.texte.includes('Interaction'));
    expect(interaction.sources.map((s: { titre: string }) => s.titre)).toEqual([
      'Ordonnance du 28 octobre 2026',
    ]);
    expect(audit.forPatient(FLORENCE_ID).some((e) => e.resourceType === 'Resume')).toBe(true);
  });

  it('résumé en anglais et contrôle d’accès', async () => {
    const res = await http().get(`/patients/${FLORENCE_ID}/resume?lang=en`).set(nana).expect(200);
    expect(res.body.titres.traitements).toBe('Current treatments');
    await http().get(`/patients/${FLORENCE_ID}/resume`).set(kamga).expect(403);
    await http().get(`/patients/${FLORENCE_ID}/resume`).expect(401);
  });
});

describe('détection de langue et modèle simulé', () => {
  it('détecte fr / en, français par défaut', () => {
    expect(detectLanguage('Quel est le dernier INR ?')).toBe('fr');
    expect(detectLanguage('What is the latest INR?')).toBe('en');
    expect(detectLanguage('INR')).toBe('fr');
  });

  it('le modèle simulé est déterministe et insère les marqueurs [n]', async () => {
    const passages = [1, 2].map((n) => ({
      id: `p${n}`,
      patientId: 'x',
      documentId: `d${n}`,
      title: 'T',
      date: '2026-01-01',
      text: `Texte ${n}.`,
    }));
    const model = new MockClinicalLanguageModel();
    const first = await model.generate({ question: 'q', passages, language: 'fr' });
    expect(first).toBe('D’après le dossier : Texte 1. [1] Texte 2. [2]');
    expect(await model.generate({ question: 'q', passages, language: 'fr' })).toBe(first);
  });

  it('valide IA_CLINIQUE_PORT', () => {
    expect(loadEnv({})).toMatchObject({ port: 3003 });
    expect(loadEnv({ IA_CLINIQUE_PORT: '4003' })).toMatchObject({ port: 4003 });
    expect(() => loadEnv({ IA_CLINIQUE_PORT: 'abc' })).toThrow('IA_CLINIQUE_PORT invalide');
  });
});
