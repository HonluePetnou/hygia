import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditLog } from '@hygia/audit';
import { AccessPolicy } from '../access/access-policy.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CONSENT_GATE, type ConsentGate } from '../consent/consent-gate.js';
import { AUDIT_LOG } from '../copilote/copilote.service.js';
import type { ConsultationDraft } from '../model/consultation-draft.js';
import { CLINICAL_LANGUAGE_MODEL, type ClinicalLanguageModel } from '../model/clinical-language-model.js';
import { DOSSIER_WRITER, type DossierWriter } from './dossier-writer.js';
import {
  SCRIBE_SESSION_STORE,
  toView,
  type ScribeSession,
  type ScribeSessionStore,
  type ScribeSessionView,
} from './scribe-session.js';
import { TRANSCRIBER, type Transcriber } from './transcriber.js';

/**
 * Scribe de consultation (RF9) : enregistrement avec accord du patient, transcription, brouillon
 * structuré, puis validation par le médecin. Rien n'atteint le dossier sans cette validation ;
 * l'audio est supprimé dès la validation ou le rejet.
 */
@Injectable()
export class ScribeService {
  constructor(
    @Inject(SCRIBE_SESSION_STORE) private readonly store: ScribeSessionStore,
    @Inject(TRANSCRIBER) private readonly transcriber: Transcriber,
    @Inject(CLINICAL_LANGUAGE_MODEL) private readonly model: ClinicalLanguageModel,
    @Inject(DOSSIER_WRITER) private readonly writer: DossierWriter,
    @Inject(CONSENT_GATE) private readonly consent: ConsentGate,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    private readonly policy: AccessPolicy,
  ) {}

  /** Ouvre une séance ; 403 sans consentement « enregistrement audio » (ou IA) du patient. */
  async start(user: AuthenticatedUser, patientId: string): Promise<ScribeSessionView> {
    this.requirePhysician(user);
    this.policy.require(user, patientId);
    if (!(await this.consent.allows(patientId, 'audio'))) {
      throw new ForbiddenException('Le patient n’a pas consenti à l’enregistrement audio');
    }
    if (!(await this.consent.allows(patientId, 'ia'))) {
      throw new ForbiddenException('Le patient a refusé l’usage de l’IA sur son dossier');
    }
    const session: ScribeSession = {
      id: randomUUID(),
      patientId,
      ownerId: user.id,
      status: 'recording',
      startedAt: new Date().toISOString(),
    };
    this.store.save(session);
    this.record(user, session, 'creation');
    return toView(session);
  }

  /** Reçoit l'audio, le transcrit et structure le brouillon (état « à valider »). */
  async upload(
    user: AuthenticatedUser,
    id: string,
    audio: Uint8Array,
    durationSeconds?: number,
  ): Promise<ScribeSessionView> {
    const session = this.owned(user, id);
    if (session.status !== 'recording') throw new ConflictException('Audio déjà reçu pour cette séance');
    session.audio = audio;
    if (durationSeconds !== undefined) session.durationSeconds = durationSeconds;
    session.transcript = await this.transcriber.transcribe(audio);
    session.draft = await this.model.structureConsultation({
      transcript: session.transcript,
      language: 'fr',
    });
    session.status = 'draft_ready';
    this.record(user, session, 'modification');
    return toView(session);
  }

  /** Séance courante (brouillon à valider ou état final). */
  get(user: AuthenticatedUser, id: string): ScribeSessionView {
    const session = this.owned(user, id);
    this.record(user, session, 'lecture');
    return toView(session);
  }

  /**
   * Valide le brouillon (éventuellement corrigé) : crée les ressources dans Dossiers au nom du
   * médecin puis supprime l'audio. Si Dossiers échoue, la séance reste à valider, audio conservé.
   */
  async validate(
    user: AuthenticatedUser,
    id: string,
    authorization: string,
    corrected?: ConsultationDraft,
  ): Promise<ScribeSessionView> {
    const session = this.owned(user, id);
    if (session.status !== 'draft_ready' || !session.draft) {
      throw new ConflictException('Aucun brouillon à valider pour cette séance');
    }
    const draft = corrected ?? session.draft;
    session.createdResourceIds = await this.writer.recordConsultation(
      authorization,
      session.patientId,
      draft,
    );
    session.draft = draft;
    session.status = 'validated';
    delete session.audio;
    this.record(user, session, 'creation');
    return toView(session);
  }

  /** Rejette le brouillon : rien n'est créé, audio, transcription et brouillon sont supprimés. */
  reject(user: AuthenticatedUser, id: string): ScribeSessionView {
    const session = this.owned(user, id);
    if (session.status === 'validated' || session.status === 'rejected') {
      throw new ConflictException('Séance déjà clôturée');
    }
    delete session.audio;
    delete session.transcript;
    delete session.draft;
    session.status = 'rejected';
    this.record(user, session, 'modification');
    return toView(session);
  }

  private requirePhysician(user: AuthenticatedUser): void {
    if (user.role !== 'medecin') throw new ForbiddenException('Le scribe est réservé aux médecins');
  }

  /** Séance du médecin connecté : 404 si inconnue ou appartenant à un autre médecin. */
  private owned(user: AuthenticatedUser, id: string): ScribeSession {
    this.requirePhysician(user);
    const session = this.store.find(id);
    if (!session || session.ownerId !== user.id) throw new NotFoundException('Séance introuvable');
    return session;
  }

  private record(
    user: AuthenticatedUser,
    session: ScribeSession,
    action: 'lecture' | 'creation' | 'modification',
  ): void {
    this.audit.append({
      actor: user.id,
      role: user.role,
      action,
      resourceType: 'ScribeSession',
      resourceId: session.id,
      patientId: session.patientId,
      reason: 'soins',
    });
  }
}
