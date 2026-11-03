import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditLog } from '@hygia/audit';
import type { DocumentReference, Patient } from '@hygia/types';
import { AccessPolicy } from '../access/access-policy.js';
import { CLOCK, type Clock } from '../access/clock.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { PATIENT_REPOSITORY, type PatientRepository } from '../patients/patient-repository.js';
import { AUDIT_LOG } from '../patients/audit-token.js';
import { DOCUMENT_STORE, type DocumentStore } from './document-store.js';
import type { ResourceVersion, VersionedType } from './resource-version.js';

/** Auteur de l'état initial, enregistré lors de la première modification. */
export const SYSTEM_AUTHOR = 'système';
const INITIAL_REASON = 'état initial';

/**
 * Historique des versions (RF5) : chaque modification crée une version immuable, les anciennes
 * restent lisibles, et chaque lecture est auditée.
 */
@Injectable()
export class VersionsService {
  constructor(
    @Inject(DOCUMENT_STORE) private readonly store: DocumentStore,
    @Inject(PATIENT_REPOSITORY) private readonly repository: PatientRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly policy: AccessPolicy,
  ) {}

  /**
   * Enregistre une modification. À la première, l'état d'avant est conservé comme version
   * initiale pour pouvoir être relu et comparé.
   */
  async recordChange(
    type: VersionedType,
    before: Patient | DocumentReference,
    after: Patient | DocumentReference,
    patientId: string,
    user: AuthenticatedUser,
    reason: string,
  ): Promise<ResourceVersion> {
    const now = this.clock.now().toISOString();
    const base = { resourceId: after.id, resourceType: type, patientId };
    if ((await this.store.list(after.id)).length === 0) {
      await this.store.append({
        ...base,
        number: before.version,
        author: SYSTEM_AUTHOR,
        createdAt: now,
        reason: INITIAL_REASON,
        content: { ...before },
      });
    }
    return this.store.append({
      ...base,
      number: after.version,
      author: user.id,
      createdAt: now,
      reason,
      content: { ...after },
    });
  }

  /** Historique d'un patient : versions de la fiche et de ses documents, du plus récent au plus ancien. */
  async forPatient(user: AuthenticatedUser, patientId: string): Promise<ResourceVersion[]> {
    this.policy.assertClinical(user);
    const patient = this.repository.findById(patientId);
    if (!patient) throw new NotFoundException('Patient introuvable');
    this.policy.requireAccess(user, patient.id);
    const versions = await this.store.listForPatient(patient.id);
    this.record(user, patient.id, 'PatientVersions', patient.id);
    return versions;
  }

  /** Versions d'un document, de la plus ancienne à la plus récente. */
  async forDocument(user: AuthenticatedUser, documentId: string): Promise<ResourceVersion[]> {
    const patientId = this.authorizeDocument(user, documentId);
    const versions = await this.store.list(documentId);
    this.record(user, patientId, 'DocumentVersions', documentId);
    return versions;
  }

  /** Une version précise d'un document (404 si elle n'existe pas). */
  async documentVersion(
    user: AuthenticatedUser,
    documentId: string,
    number: number,
  ): Promise<ResourceVersion> {
    const patientId = this.authorizeDocument(user, documentId);
    const version = await this.store.get(documentId, number);
    if (!version) throw new NotFoundException(`Version ${number} introuvable`);
    this.record(user, patientId, `DocumentReference@v${number}`, documentId);
    return version;
  }

  /** Contrôle de rôle, d'existence puis d'équipe ; renvoie le patient du document. */
  authorizeDocument(user: AuthenticatedUser, documentId: string): string {
    this.policy.assertClinical(user);
    const document = this.repository.findDocument(documentId);
    if (!document) throw new NotFoundException('Document introuvable');
    const patientId = document.subject.reference.split('/')[1] ?? '';
    this.policy.requireAccess(user, patientId);
    return patientId;
  }

  private record(user: AuthenticatedUser, patientId: string, resourceType: string, id: string): void {
    this.audit.append({
      actor: user.id,
      role: user.role,
      action: 'lecture',
      resourceType,
      resourceId: id,
      patientId,
      reason: this.policy.basisFor(user, patientId) === 'bris_de_glace' ? 'bris_de_glace' : 'soins',
    });
  }
}
