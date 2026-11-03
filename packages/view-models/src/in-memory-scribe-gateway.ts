import { GatewayError } from './http-client.js';
import type { ScribeGateway } from './scribe-gateway.js';
import type { ScribeDraftData, ScribeSessionData } from './scribe-types.js';

/** Brouillon fictif de démonstration (même consultation que la transcription simulée du service). */
export const DEMO_SCRIBE_DRAFT: ScribeDraftData = {
  motif: 'Je viens renouveler mon traitement contre la tension, et j’ai des maux de tête le matin.',
  examen: 'TA 162/98 mmHg, FC 76 bpm. Pas d’œdème des jambes.',
  observations: [],
  diagnostics: [
    { system: 'http://hl7.org/fhir/sid/icd-10', code: 'I10', display: 'Hypertension essentielle' },
  ],
  prescriptions: [
    {
      medication: { system: 'http://www.whocc.no/atc', code: 'C08CA01', display: 'Amlodipine' },
      doseValue: 10,
      doseUnit: 'mg',
      timesPerDay: 1,
      note: 'contrôle dans 4 semaines',
    },
  ],
};

/** Scribe hors ligne (démo sans service) : brouillon fixe, rien n'est enregistré. */
export class InMemoryScribeGateway implements ScribeGateway {
  /** Patients dont le consentement audio est refusé (tests). */
  readonly refused = new Set<string>();
  private readonly sessions = new Map<string, ScribeSessionData>();
  private counter = 0;

  async start(patientId: string): Promise<ScribeSessionData> {
    if (this.refused.has(patientId)) throw new GatewayError(403, 'consentement audio refusé');
    const session: ScribeSessionData = {
      id: `scribe-${++this.counter}`,
      patientId,
      status: 'recording',
      audioStored: false,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async sendAudio(
    sessionId: string,
    _audioBase64: string,
    durationSeconds: number,
  ): Promise<ScribeSessionData> {
    return this.update(sessionId, {
      status: 'draft_ready',
      durationSeconds,
      audioStored: true,
      draft: DEMO_SCRIBE_DRAFT,
    });
  }

  async validate(sessionId: string, draft: ScribeDraftData): Promise<ScribeSessionData> {
    return this.update(sessionId, {
      status: 'validated',
      audioStored: false,
      draft,
      createdResourceIds: [],
    });
  }

  async reject(sessionId: string): Promise<ScribeSessionData> {
    const session: ScribeSessionData = {
      ...this.find(sessionId),
      status: 'rejected',
      audioStored: false,
    };
    delete session.draft;
    this.sessions.set(sessionId, session);
    return session;
  }

  private find(id: string): ScribeSessionData {
    const session = this.sessions.get(id);
    if (!session) throw new GatewayError(404, 'séance introuvable');
    return session;
  }

  private update(id: string, changes: Partial<ScribeSessionData>): ScribeSessionData {
    const session = { ...this.find(id), ...changes };
    this.sessions.set(id, session);
    return session;
  }
}
