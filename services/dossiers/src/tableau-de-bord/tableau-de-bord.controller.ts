import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuditLog } from '@hygia/audit';
import { AccessPolicy } from '../access/access-policy.js';
import { CLOCK, type Clock } from '../access/clock.js';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ENV } from '../config/env-token.js';
import type { Env } from '../config/env.js';
import { AUDIT_LOG } from '../patients/audit-token.js';
import { PATIENT_REPOSITORY, type PatientRepository } from '../patients/patient-repository.js';
import { buildDashboard, type DashboardData } from './dashboard.js';

/** Tableau de bord du soignant (`GET /tableau-de-bord`), limité à ses équipes de soins. */
@ApiTags('tableau-de-bord')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Jeton absent, invalide ou expiré' })
@ApiResponse({ status: 403, description: 'Rôle sans accès aux données de santé' })
@UseGuards(JwtAuthGuard)
@Controller('tableau-de-bord')
export class TableauDeBordController {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repository: PatientRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
    private readonly policy: AccessPolicy,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Consultations du jour, alertes, documents et résultats à valider' })
  get(@CurrentUser() user: AuthenticatedUser): DashboardData {
    this.policy.assertClinical(user);
    const records = this.repository
      .activePatients()
      .filter((patient) => this.policy.basisFor(user, patient.id) !== undefined)
      .map((patient) => ({
        patient,
        record: this.repository.recordOf(patient.id),
        allergies: this.repository.allergiesOf(patient.id),
      }));
    // Chaque dossier résumé sur le tableau de bord est une lecture auditée (RF24).
    for (const { patient } of records) {
      const basis = this.policy.basisFor(user, patient.id);
      this.audit.append({
        actor: user.id,
        role: user.role,
        action: 'lecture',
        resourceType: 'Patient',
        resourceId: patient.id,
        patientId: patient.id,
        reason: basis === 'bris_de_glace' ? 'bris_de_glace' : 'soins',
      });
    }
    const day = this.env.dashboardDate ?? this.clock.now().toISOString().slice(0, 10);
    return buildDashboard(records, day);
  }
}
