import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditLog } from '@hygia/audit';
import type { Patient } from '@hygia/types';
import { AccessPolicy } from '../access/access-policy.js';
import { CLOCK, type Clock } from '../access/clock.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AUDIT_LOG } from '../patients/audit-token.js';
import {
  PATIENT_REPOSITORY,
  type MergeRecord,
  type PatientRepository,
} from '../patients/patient-repository.js';
import { VersionsService } from '../versions/versions.service.js';
import { chosenFields, type MergeRequest } from './dto.js';

/** Fusion effectuée, telle que renvoyée au client. */
export interface MergeResult {
  id: string;
  keptId: string;
  mergedId: string;
  mergedAt: string;
  by: string;
  reason: string;
  undone: boolean;
  /** Nombre de ressources déplacées sous le dossier conservé, par type. */
  moved: { encounters: number; observations: number; medicationRequests: number; documents: number };
  kept: Patient;
  merged: Patient;
}

interface StoredMerge {
  result: MergeResult;
  record: MergeRecord;
}

/** Fusion validée par un humain de deux dossiers, auditée et annulable. */
@Injectable()
export class MergeService {
  private readonly merges = new Map<string, StoredMerge>();

  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repository: PatientRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly policy: AccessPolicy,
    private readonly versions: VersionsService,
  ) {}

  /** Fusionne `mergedId` dans `keptId` : rien n'est supprimé, tout est rattaché au dossier conservé. */
  async merge(
    user: AuthenticatedUser,
    keptId: string,
    mergedId: string,
    request: MergeRequest,
  ): Promise<MergeResult> {
    const { kept, merged } = this.load(user, keptId, mergedId);
    if (request.versions && (request.versions.a !== kept.version || request.versions.b !== merged.version)) {
      throw new ConflictException(
        `Version périmée : attendues ${kept.version} et ${merged.version}, reçues ${request.versions.a} et ${request.versions.b}`,
      );
    }
    const record = this.repository.merge(keptId, mergedId, chosenFields(kept, merged, request.choices));
    const reason = `fusion : ${request.reason}`;
    await this.versions.recordChange('Patient', kept, record.keptAfter, keptId, user, reason);
    await this.versions.recordChange('Patient', merged, record.mergedAfter, mergedId, user, reason);
    this.trace(user, record.keptAfter, `fusion de ${merged.ipp} dans ${kept.ipp} : ${request.reason}`);
    this.trace(user, record.mergedAfter, `fusionné dans ${kept.ipp} : ${request.reason}`);
    const result: MergeResult = {
      id: randomUUID(),
      keptId,
      mergedId,
      mergedAt: this.clock.now().toISOString(),
      by: user.id,
      reason: request.reason,
      undone: false,
      moved: {
        encounters: record.moved.encounters.length,
        observations: record.moved.observations.length,
        medicationRequests: record.moved.medicationRequests.length,
        documents: record.moved.documents.length,
      },
      kept: record.keptAfter,
      merged: record.mergedAfter,
    };
    this.merges.set(result.id, { result, record });
    return result;
  }

  /** Annule une fusion : ressources et fiches reviennent à l'état d'avant (409 si une fiche a changé depuis). */
  async undo(user: AuthenticatedUser, id: string): Promise<MergeResult> {
    const stored = this.merges.get(id);
    if (!stored) throw new NotFoundException('Fusion introuvable');
    const { record, result } = stored;
    this.assertAccess(user, record.keptBefore.id, record.mergedBefore.id);
    if (result.undone) throw new ConflictException('Fusion déjà annulée');
    const keptNow = this.repository.findById(record.keptBefore.id);
    const mergedNow = this.repository.findById(record.mergedBefore.id);
    if (keptNow?.version !== record.keptAfter.version || mergedNow?.version !== record.mergedAfter.version) {
      throw new ConflictException('Une fiche a été modifiée depuis la fusion : annulation impossible');
    }
    this.repository.unmerge(record);
    const kept = this.repository.findById(record.keptBefore.id) as Patient;
    const merged = this.repository.findById(record.mergedBefore.id) as Patient;
    const reason = 'annulation de la fusion';
    await this.versions.recordChange('Patient', keptNow, kept, kept.id, user, reason);
    await this.versions.recordChange('Patient', mergedNow, merged, merged.id, user, reason);
    this.trace(user, kept, `${reason} de ${merged.ipp} dans ${kept.ipp}`);
    this.trace(user, merged, `${reason} dans ${kept.ipp}`);
    stored.result = { ...result, undone: true, kept, merged };
    return stored.result;
  }

  private load(user: AuthenticatedUser, keptId: string, mergedId: string): { kept: Patient; merged: Patient } {
    if (keptId === mergedId) throw new BadRequestException('Deux dossiers distincts sont requis');
    this.assertAccess(user, keptId, mergedId);
    const kept = this.repository.findById(keptId) as Patient;
    const merged = this.repository.findById(mergedId) as Patient;
    if (kept.mergedInto !== undefined || merged.mergedInto !== undefined) {
      throw new ConflictException('Un des dossiers a déjà été fusionné');
    }
    return { kept, merged };
  }

  /** Rôle (403), existence (404) puis accès aux deux dossiers (403). */
  private assertAccess(user: AuthenticatedUser, ...ids: string[]): void {
    this.policy.assertClinical(user);
    for (const id of ids) {
      if (!this.repository.findById(id)) throw new NotFoundException('Patient introuvable');
    }
    for (const id of ids) {
      // Un dossier fusionné n'a plus de contenu : l'accès suit le dossier conservé.
      this.policy.requireAccess(user, this.repository.findById(id)?.mergedInto ?? id);
    }
  }

  private trace(user: AuthenticatedUser, patient: Patient, reason: string): void {
    this.audit.append({
      actor: user.id,
      role: user.role,
      action: 'modification',
      resourceType: 'Patient',
      resourceId: patient.id,
      patientId: patient.id,
      reason: this.policy.basisFor(user, patient.id) === 'bris_de_glace' ? `bris_de_glace — ${reason}` : reason,
    });
  }
}
