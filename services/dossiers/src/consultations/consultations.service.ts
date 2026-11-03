import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditLog } from '@hygia/audit';
import { AccessPolicy } from '../access/access-policy.js';
import { CLOCK, type Clock } from '../access/clock.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AUDIT_LOG } from '../patients/audit-token.js';
import { PATIENT_REPOSITORY, type PatientRepository } from '../patients/patient-repository.js';
import type { ConsultationInput, ConsultationResources } from './consultation.js';

/** Enregistre une consultation validée par un médecin (écriture auditée, une ligne par ressource). */
@Injectable()
export class ConsultationsService {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repository: PatientRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly policy: AccessPolicy,
  ) {}

  /** Crée la consultation et ses ressources (version 1) ; réservé aux médecins de l'équipe. */
  record(
    user: AuthenticatedUser,
    patientId: string,
    input: ConsultationInput,
  ): ConsultationResources {
    this.policy.assertClinical(user);
    if (user.role !== 'medecin') {
      throw new ForbiddenException('Seul un médecin valide une consultation');
    }
    const patient = this.repository.findById(patientId);
    if (!patient) throw new NotFoundException('Patient introuvable');
    const basis = this.policy.requireAccess(user, patient.id);
    const created = this.repository.addConsultation(patient.id, user.id, input, this.clock.now());
    const resources = [
      created.encounter,
      ...created.observations,
      ...created.conditions,
      ...created.medicationRequests,
    ];
    for (const resource of resources) {
      this.audit.append({
        actor: user.id,
        role: user.role,
        action: 'creation',
        resourceType: resource.resourceType,
        resourceId: resource.id,
        patientId: patient.id,
        reason: basis === 'bris_de_glace' ? 'bris_de_glace' : 'soins',
      });
    }
    return created;
  }
}
