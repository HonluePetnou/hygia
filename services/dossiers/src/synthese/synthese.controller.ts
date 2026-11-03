import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PATIENT_REPOSITORY, type PatientRepository } from '../patients/patient-repository.js';
import { PatientsService } from '../patients/patients.service.js';
import { buildOverview, type PatientOverview } from './overview.js';

/** Synthèse d'un dossier (`GET /patients/:id/synthese`) : en-tête et colonne de droite du web. */
@ApiTags('patients')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Jeton absent, invalide ou expiré' })
@ApiResponse({ status: 403, description: 'Accès refusé (rôle ou équipe de soins)' })
@UseGuards(JwtAuthGuard)
@Controller('patients')
export class SyntheseController {
  constructor(
    private readonly patients: PatientsService,
    @Inject(PATIENT_REPOSITORY) private readonly repository: PatientRepository,
  ) {}

  @Get(':id/synthese')
  @ApiOperation({ summary: 'Allergies, anticoagulant, constantes, traitements et équipe de soins' })
  overview(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): PatientOverview {
    // Contrôle d'accès et lecture auditée, comme la fiche patient.
    const patient = this.patients.get(user, id);
    return buildOverview(
      patient,
      this.repository.recordOf(patient.id),
      this.repository.allergiesOf(patient.id),
      this.repository.careTeamOf(patient.id),
    );
  }
}
