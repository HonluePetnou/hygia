import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditLog, InMemoryAuditStore } from '@hygia/audit';
import { TokenIssuer, localVerifier } from '@hygia/auth';
import { FLORENCE_ID, NANA_ID } from '@hygia/fhir';
import type { Role } from '@hygia/types';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { TOKEN_VERIFIER } from '../src/auth/jwt-auth.guard.js';
import { CONSENT_GATE, type ConsentGate, type ConsentPurpose } from '../src/consent/consent-gate.js';
import { AUDIT_LOG } from '../src/copilote/copilote.service.js';
import type { ConsultationDraft } from '../src/model/consultation-draft.js';
import { DOSSIER_WRITER, type DossierWriter } from '../src/scribe/dossier-writer.js';
import { InMemoryScribeSessionStore, SCRIBE_SESSION_STORE } from '../src/scribe/scribe-session.js';

const TEAM_ID = '00000000-0000-4000-8000-040000000001';
const KAMGA_ID = '00000000-0000-4000-8000-020000000003';
const AUDIO = Buffer.from('audio-fictif').toString('base64');

class FakeConsentGate implements ConsentGate {
  readonly refused = new Set<ConsentPurpose>();
  allows(_patientId: string, purpose: ConsentPurpose): Promise<boolean> {
    return Promise.resolve(!this.refused.has(purpose));
  }
}

/** Dossiers simulé : mémorise les consultations reçues. */
class FakeDossierWriter implements DossierWriter {
  readonly written: { authorization: string; patientId: string; draft: ConsultationDraft }[] = [];
  failing = false;
  recordConsultation(authorization: string, patientId: string, draft: ConsultationDraft) {
    if (this.failing) return Promise.reject(new Error('Dossiers indisponible'));
    this.written.push({ authorization, patientId, draft });
    return Promise.resolve(['enc-1', 'obs-1', 'obs-2', 'obs-3', 'cond-1', 'med-1']);
  }
}

describe('scribe de consultation', () => {
  let app: INestApplication;
  let consent: FakeConsentGate;
  let writer: FakeDossierWriter;
  let sessions: InMemoryScribeSessionStore;
  let audit: AuditLog;
  let nana: Record<string, string>;
  let kamga: Record<string, string>;
  let nurse: Record<string, string>;

  beforeEach(async () => {
    consent = new FakeConsentGate();
    writer = new FakeDossierWriter();
    sessions = new InMemoryScribeSessionStore();
    audit = new AuditLog(new InMemoryAuditStore());
    const issuer = await TokenIssuer.create();
    const as = async (sub: string, role: Role, teams: string[] = []) => ({
      authorization: `Bearer ${(await issuer.issue({ sub, role, teams, emergency: [] }, new Date())).token}`,
    });
    nana = await as(NANA_ID, 'medecin', [TEAM_ID]);
    kamga = await as(KAMGA_ID, 'medecin');
    nurse = await as(NANA_ID, 'infirmier', [TEAM_ID]);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(localVerifier(issuer.jwks()))
      .overrideProvider(CONSENT_GATE)
      .useValue(consent)
      .overrideProvider(DOSSIER_WRITER)
      .useValue(writer)
      .overrideProvider(SCRIBE_SESSION_STORE)
      .useValue(sessions)
      .overrideProvider(AUDIT_LOG)
      .useValue(audit)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const start = (headers = nana) =>
    http().post(`/scribe/patients/${FLORENCE_ID}/sessions`).set(headers).send();
  const send = (id: string, headers = nana) =>
    http()
      .post(`/scribe/sessions/${id}/audio`)
      .set(headers)
      .send({ audioBase64: AUDIO, durationSeconds: 277 });
  /** Séance jusqu'au brouillon à valider. */
  async function draftReady(): Promise<string> {
    const id = (await start().expect(201)).body.id as string;
    await send(id).expect(200);
    return id;
  }

  it('refuse sans consentement « enregistrement audio » (ou IA), pour un infirmier et hors équipe', async () => {
    consent.refused.add('audio');
    await start().expect(403);
    consent.refused.clear();
    consent.refused.add('ia');
    await start().expect(403);
    consent.refused.clear();
    await start(nurse).expect(403);
    await start(kamga).expect(403);
    await http().post(`/scribe/patients/${FLORENCE_ID}/sessions`).send().expect(401);
    await http()
      .post('/scribe/patients/00000000-0000-4000-8000-ffffffffffff/sessions')
      .set(nana)
      .send()
      .expect(404);
    expect(sessions.find('x')).toBeUndefined();
    expect(audit.events().filter((e) => e.resourceType === 'ScribeSession')).toHaveLength(0);
  });

  it('structure la transcription en brouillon : motif, examen, CIM-10, prescription', async () => {
    const id = (await start().expect(201)).body.id as string;
    const res = await send(id).expect(200);
    expect(res.body).toMatchObject({ status: 'draft_ready', generatedByAi: true, audioStored: true });
    const draft = res.body.draft as ConsultationDraft;
    expect(draft.motif).toContain('traitement contre la tension');
    expect(draft.examen).toBe('TA 162/98 mmHg, FC 76 bpm. Pas d’œdème des jambes.');
    expect(draft.diagnostics).toEqual([
      { system: 'http://hl7.org/fhir/sid/icd-10', code: 'I10', display: 'Hypertension essentielle' },
    ]);
    expect(draft.prescriptions[0]).toMatchObject({
      medication: { code: 'C08CA01' },
      doseValue: 10,
      doseUnit: 'mg',
      timesPerDay: 1,
      note: 'contrôle dans 4 semaines',
    });
    expect(draft.observations.map((o) => o.value)).toEqual([162, 98, 76]);
    // Rien n'est écrit au dossier tant que le médecin n'a pas validé.
    expect(writer.written).toHaveLength(0);
    const read = await http().get(`/scribe/sessions/${id}`).set(nana).expect(200);
    expect(read.body.draft).toEqual(draft);
    // Une séance n'est visible que de son médecin (404, sans révéler son existence).
    await http().get(`/scribe/sessions/${id}`).set(kamga).expect(404);
  });

  it('la validation crée les ressources via Dossiers (jeton du médecin) et supprime l’audio', async () => {
    const id = await draftReady();
    const res = await http().post(`/scribe/sessions/${id}/validation`).set(nana).send({}).expect(200);
    expect(res.body).toMatchObject({ status: 'validated', audioStored: false });
    expect(res.body.createdResourceIds).toHaveLength(6);
    expect(writer.written).toHaveLength(1);
    expect(writer.written[0]).toMatchObject({ patientId: FLORENCE_ID, authorization: nana['authorization'] });
    expect(sessions.find(id)?.audio).toBeUndefined();
    await http().post(`/scribe/sessions/${id}/validation`).set(nana).send({}).expect(409);
    expect(
      audit.events().some((e) => e.resourceType === 'ScribeSession' && e.action === 'creation'),
    ).toBe(true);
  });

  it('la validation enregistre le brouillon corrigé par le médecin', async () => {
    const id = await draftReady();
    const draft = (await http().get(`/scribe/sessions/${id}`).set(nana)).body.draft as ConsultationDraft;
    const corrected = {
      ...draft,
      prescriptions: draft.prescriptions.map((p) => ({ ...p, doseValue: 5 })),
    };
    await http()
      .post(`/scribe/sessions/${id}/validation`)
      .set(nana)
      .send({ draft: corrected })
      .expect(200);
    expect(writer.written[0]?.draft.prescriptions[0]?.doseValue).toBe(5);
    const id2 = await draftReady();
    await http()
      .post(`/scribe/sessions/${id2}/validation`)
      .set(nana)
      .send({ draft: { motif: 1 } })
      .expect(400);
  });

  it('un échec de Dossiers laisse le brouillon à valider et l’audio en place', async () => {
    const id = await draftReady();
    writer.failing = true;
    await http().post(`/scribe/sessions/${id}/validation`).set(nana).send({}).expect(500);
    expect(sessions.find(id)).toMatchObject({ status: 'draft_ready' });
    expect(sessions.find(id)?.audio).toBeDefined();
  });

  it('le rejet ne crée rien et supprime audio, transcription et brouillon', async () => {
    const id = await draftReady();
    const res = await http().post(`/scribe/sessions/${id}/rejet`).set(nana).send().expect(200);
    expect(res.body).toMatchObject({ status: 'rejected', audioStored: false });
    expect(res.body.draft).toBeUndefined();
    expect(writer.written).toHaveLength(0);
    const stored = sessions.find(id);
    expect(stored?.audio).toBeUndefined();
    expect(stored?.transcript).toBeUndefined();
    await http().post(`/scribe/sessions/${id}/validation`).set(nana).send({}).expect(409);
  });

  it('400 pour un audio vide ou mal encodé, 409 pour un second envoi', async () => {
    const id = (await start().expect(201)).body.id as string;
    await http().post(`/scribe/sessions/${id}/audio`).set(nana).send({ audioBase64: '' }).expect(400);
    await http().post(`/scribe/sessions/${id}/audio`).set(nana).send({ audioBase64: '%%%' }).expect(400);
    await send(id).expect(200);
    await send(id).expect(409);
  });
});
