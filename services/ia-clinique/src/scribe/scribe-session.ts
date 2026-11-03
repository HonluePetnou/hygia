import type { ConsultationDraft } from '../model/consultation-draft.js';

/** Étapes d'une séance : enregistrement, brouillon à valider, puis validé ou rejeté. */
export type ScribeStatus = 'recording' | 'draft_ready' | 'validated' | 'rejected';

/** Séance de scribe d'un médecin auprès d'un patient. */
export interface ScribeSession {
  id: string;
  patientId: string;
  /** Médecin propriétaire : seul lui lit, corrige, valide ou rejette. */
  ownerId: string;
  status: ScribeStatus;
  startedAt: string;
  durationSeconds?: number;
  /** Audio brut, supprimé dès la validation ou le rejet. */
  audio?: Uint8Array;
  transcript?: string;
  draft?: ConsultationDraft;
  /** Identifiants des ressources créées dans Dossiers, après validation. */
  createdResourceIds?: string[];
}

/** Jeton d'injection de `ScribeSessionStore`. */
export const SCRIBE_SESSION_STORE = Symbol('SCRIBE_SESSION_STORE');

/** Stockage des séances (en mémoire ; S3 chiffré à durée de vie courte ensuite). */
export interface ScribeSessionStore {
  save(session: ScribeSession): void;
  find(id: string): ScribeSession | undefined;
}

/** Magasin en mémoire. */
export class InMemoryScribeSessionStore implements ScribeSessionStore {
  private readonly sessions = new Map<string, ScribeSession>();

  save(session: ScribeSession): void {
    this.sessions.set(session.id, session);
  }

  find(id: string): ScribeSession | undefined {
    return this.sessions.get(id);
  }
}

/** Vue d'une séance renvoyée par l'API : jamais l'audio, seulement sa présence. */
export interface ScribeSessionView {
  id: string;
  patientId: string;
  status: ScribeStatus;
  startedAt: string;
  durationSeconds?: number;
  audioStored: boolean;
  transcript?: string;
  draft?: ConsultationDraft;
  createdResourceIds?: string[];
  /** Le brouillon est généré par IA et doit être validé par le médecin. */
  generatedByAi: true;
}

/** Projette une séance vers sa vue publique. */
export function toView(session: ScribeSession): ScribeSessionView {
  return {
    id: session.id,
    patientId: session.patientId,
    status: session.status,
    startedAt: session.startedAt,
    ...(session.durationSeconds !== undefined ? { durationSeconds: session.durationSeconds } : {}),
    audioStored: session.audio !== undefined,
    ...(session.transcript !== undefined ? { transcript: session.transcript } : {}),
    ...(session.draft ? { draft: session.draft } : {}),
    ...(session.createdResourceIds ? { createdResourceIds: session.createdResourceIds } : {}),
    generatedByAi: true,
  };
}
