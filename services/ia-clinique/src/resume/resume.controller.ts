import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ResumeService, type Resume } from './resume.service.js';

/** API du résumé pré-consultation. */
@ApiTags('resume')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'En-têtes d’identité absents ou invalides' })
@ApiResponse({ status: 403, description: 'Accès refusé (rôle ou équipe de soins)' })
@UseGuards(JwtAuthGuard)
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
  ): Promise<Resume> {
    return this.service.summarize(user, id, lang === 'en' ? 'en' : 'fr');
  }
}
