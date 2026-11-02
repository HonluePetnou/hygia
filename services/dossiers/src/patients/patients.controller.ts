import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Patient } from '@hygia/types';
import type { AuditEvent } from '@hygia/audit';
import type { Response } from 'express';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { HeaderAuthGuard } from '../auth/header-auth.guard.js';
import {
  BreakGlassDto,
  UpdatePatientDto,
  parseBreakGlass,
  parseIfMatch,
  parsePatientChanges,
} from './dto.js';
import { PatientsService } from './patients.service.js';
import type { TimelineEvent } from './timeline.js';

/** API REST des patients et dossiers. */
@ApiTags('patients')
@ApiHeader({ name: 'x-user-id', description: 'Identifiant utilisateur (auth simulée, démo)' })
@ApiHeader({ name: 'x-user-role', description: 'Rôle applicatif (auth simulée, démo)' })
@ApiResponse({ status: 401, description: 'En-têtes d’identité absents ou invalides' })
@ApiResponse({ status: 403, description: 'Accès refusé (rôle ou équipe de soins)' })
@UseGuards(HeaderAuthGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly service: PatientsService) {}

  @Get()
  @ApiOperation({ summary: 'Recherche de patients par nom ou IPP (équipe de soins uniquement)' })
  search(@CurrentUser() user: AuthenticatedUser, @Query('q') q = ''): Patient[] {
    return this.service.search(user, q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fiche patient ; l’ETag contient la version' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ): Patient {
    const patient = this.service.get(user, id);
    response.setHeader('ETag', `"${patient.version}"`);
    return patient;
  }

  @Get(':id/chronologie')
  @ApiOperation({ summary: 'Chronologie du dossier, du plus récent au plus ancien' })
  timeline(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): TimelineEvent[] {
    return this.service.timeline(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifie un patient (contrôle de version optimiste)' })
  @ApiHeader({ name: 'If-Match', description: 'Version courante du patient', required: true })
  @ApiResponse({ status: 409, description: 'Version périmée' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: UpdatePatientDto,
  ): Patient {
    return this.service.update(user, id, parsePatientChanges(body), parseIfMatch(ifMatch));
  }

  @Post(':id/bris-de-glace')
  @HttpCode(201)
  @ApiOperation({ summary: 'Ouvre un accès exceptionnel de 4 h (tracé dans l’audit)' })
  breakGlass(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: BreakGlassDto,
  ): { patientId: string; expiresAt: string } {
    return this.service.openBreakGlass(user, id, parseBreakGlass(body));
  }

  @Get(':id/acces')
  @ApiOperation({ summary: 'Journal des accès à ce dossier' })
  accessLog(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): AuditEvent[] {
    return this.service.accessLog(user, id);
  }
}
