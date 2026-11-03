import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditLog, type AuditEvent } from '@hygia/audit';
import type { Patient } from '@hygia/types';
import { AccessPolicy, type AccessBasis } from '../access/access-policy.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import type { PatientChanges } from './dto.js';
import { PATIENT_REPOSITORY, type PatientRepository } from './patient-repository.js';
import { buildTimeline, type TimelineEvent } from './timeline.js';

/** Jeton d'injection du journal d'audit. */
export const AUDIT_LOG = Symbol('AUDIT_LOG');

/** Cas d'usage sur les dossiers ; chaque lecture ou écriture est auditée (RF24). */
@Injectable()
export class PatientsService {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repository: PatientRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    private readonly policy: AccessPolicy,
  ) {}

  /** Recherche par nom ou IPP, limitée aux patients que l'utilisateur peut lire. */
  search(user: AuthenticatedUser, query: string): Patient[] {
    this.policy.assertClinical(user);
    const found = this.repository
      .search(query)
      .filter((patient) => this.policy.basisFor(user, patient.id) !== undefined);
    for (const patient of found) this.recordRead(user, patient, 'lecture');
    return found;
  }

  get(user: AuthenticatedUser, id: string): Patient {
    const patient = this.load(user, id);
    this.recordRead(user, patient, 'lecture');
    return patient;
  }

  timeline(user: AuthenticatedUser, id: string): TimelineEvent[] {
    const patient = this.load(user, id);
    this.recordRead(user, patient, 'lecture', 'chronologie');
    return buildTimeline(this.repository.recordOf(id));
  }

  update(user: AuthenticatedUser, id: string, changes: PatientChanges, version: number): Patient {
    const current = this.load(user, id);
    const result = this.repository.update(id, changes, version);
    if (result.status === 'not_found') throw new NotFoundException('Patient introuvable');
    if (result.status === 'conflict') {
      throw new ConflictException(
        `Version périmée : attendue ${result.currentVersion}, reçue ${version}`,
      );
    }
    this.recordRead(user, current, 'modification');
    return result.patient;
  }

  /**
   * Trace dans l'audit un bris de glace ouvert auprès du service Identité (`POST /bris-de-glace`) :
   * l'accès doit déjà figurer dans le jeton, sinon 403. Le motif est conservé dans l'audit.
   */
  openBreakGlass(
    user: AuthenticatedUser,
    id: string,
    justification: { motif: string; precisions: string },
  ): { patientId: string; expiresAt: string } {
    this.policy.assertClinical(user);
    const patient = this.find(id);
    const expiresAt = this.policy.emergencyExpiry(user, patient.id);
    if (expiresAt === undefined) {
      throw new ForbiddenException("Aucun accès d'urgence actif dans le jeton : passez par le service Identité");
    }
    const details = justification.precisions ? ` — ${justification.precisions}` : '';
    this.audit.append({
      actor: user.id,
      role: user.role,
      action: 'bris_de_glace',
      resourceType: 'Patient',
      resourceId: patient.id,
      patientId: patient.id,
      reason: `${justification.motif}${details}`,
    });
    return { patientId: patient.id, expiresAt };
  }

  /** Journal des accès à ce dossier (« Qui a vu mon dossier ? »). */
  accessLog(user: AuthenticatedUser, id: string): AuditEvent[] {
    const patient = this.find(id);
    if (user.role !== 'auditeur') this.policy.requireAccess(user, patient.id);
    const events = this.audit.forPatient(patient.id);
    this.audit.append({
      actor: user.id,
      role: user.role,
      action: 'lecture',
      resourceType: 'AuditLog',
      resourceId: patient.id,
      patientId: patient.id,
      reason: 'consultation du journal des accès',
    });
    return events;
  }

  private find(id: string): Patient {
    const patient = this.repository.findById(id);
    if (!patient) throw new NotFoundException('Patient introuvable');
    return patient;
  }

  /** Charge le patient après contrôle de rôle (403), d'existence (404) puis d'équipe (403). */
  private load(user: AuthenticatedUser, id: string): Patient {
    this.policy.assertClinical(user);
    const patient = this.find(id);
    this.policy.requireAccess(user, patient.id);
    return patient;
  }

  private recordRead(
    user: AuthenticatedUser,
    patient: Patient,
    action: 'lecture' | 'modification',
    resourceType = 'Patient',
  ): void {
    const basis: AccessBasis | undefined = this.policy.basisFor(user, patient.id);
    this.audit.append({
      actor: user.id,
      role: user.role,
      action,
      resourceType,
      resourceId: patient.id,
      patientId: patient.id,
      reason: basis === 'bris_de_glace' ? 'bris_de_glace' : 'soins',
    });
  }
}
