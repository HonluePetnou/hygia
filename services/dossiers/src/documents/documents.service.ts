import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditLog } from '@hygia/audit';
import type { DocumentReference } from '@hygia/types';
import { AccessPolicy } from '../access/access-policy.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AUDIT_LOG } from '../patients/audit-token.js';
import {
  PATIENT_REPOSITORY,
  type DocumentChanges,
  type PatientRepository,
} from '../patients/patient-repository.js';
import { VersionsService } from '../versions/versions.service.js';

/** Modification des documents d'un dossier : chaque changement crée une version immuable. */
@Injectable()
export class DocumentsService {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repository: PatientRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    private readonly policy: AccessPolicy,
    private readonly versions: VersionsService,
  ) {}

  /** Modifie un document (contrôle de version optimiste) et enregistre la nouvelle version. */
  async update(
    user: AuthenticatedUser,
    id: string,
    changes: DocumentChanges,
    expectedVersion: number,
    reason: string,
  ): Promise<DocumentReference> {
    const patientId = this.versions.authorizeDocument(user, id);
    const before = this.repository.findDocument(id);
    const result = this.repository.updateDocument(id, changes, expectedVersion);
    if (result.status === 'not_found' || before === undefined) {
      throw new NotFoundException('Document introuvable');
    }
    if (result.status === 'conflict') {
      throw new ConflictException(
        `Version périmée : attendue ${result.currentVersion}, reçue ${expectedVersion}`,
      );
    }
    await this.versions.recordChange('DocumentReference', before, result.resource, patientId, user, reason);
    this.audit.append({
      actor: user.id,
      role: user.role,
      action: 'modification',
      resourceType: 'DocumentReference',
      resourceId: id,
      patientId,
      reason: this.policy.basisFor(user, patientId) === 'bris_de_glace' ? 'bris_de_glace' : 'soins',
    });
    return result.resource;
  }
}
