import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { ConsultationResources } from './consultation.js';
import { ConsultationDto, parseConsultation } from './dto.js';
import { ConsultationsService } from './consultations.service.js';

/** Enregistrement d'une consultation validée (utilisé par le scribe). */
@ApiTags('consultations')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Jeton absent, invalide ou expiré' })
@ApiResponse({ status: 403, description: 'Réservé aux médecins de l’équipe de soins' })
@UseGuards(JwtAuthGuard)
@Controller('patients/:id/consultations')
export class ConsultationsController {
  constructor(private readonly service: ConsultationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crée la consultation, les mesures, diagnostics et prescriptions validés',
  })
  record(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ConsultationDto,
  ): ConsultationResources {
    return this.service.record(user, id, parseConsultation(body));
  }
}
