import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { HeaderAuthGuard } from '../auth/header-auth.guard.js';
import { ResumeService, type Resume } from './resume.service.js';

/** API du résumé pré-consultation. */
@ApiTags('resume')
@ApiHeader({ name: 'x-user-id', description: 'Identifiant utilisateur (auth simulée, démo)' })
@ApiHeader({ name: 'x-user-role', description: 'Rôle applicatif (auth simulée, démo)' })
@ApiResponse({ status: 401, description: 'En-têtes d’identité absents ou invalides' })
@ApiResponse({ status: 403, description: 'Accès refusé (rôle ou équipe de soins)' })
@UseGuards(HeaderAuthGuard)
@Controller('patients')
export class ResumeController {
  constructor(private readonly service: ResumeService) {}

  @Get(':id/resume')
  @ApiOperation({
    summary: 'Antécédents, traitements en cours, derniers résultats et alertes, avec sources',
  })
  @ApiQuery({ name: 'lang', required: false, enum: ['fr', 'en'] })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('lang') lang?: string,
  ): Resume {
    return this.service.summarize(user, id, lang === 'en' ? 'en' : 'fr');
  }
}
