import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { ResourceVersion } from './resource-version.js';
import { VersionsService } from './versions.service.js';

/** Historique des versions d'un dossier patient. */
@ApiTags('versions')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Jeton absent, invalide ou expiré' })
@ApiResponse({ status: 403, description: 'Accès refusé (rôle ou équipe de soins)' })
@UseGuards(JwtAuthGuard)
@Controller('patients')
export class VersionsController {
  constructor(private readonly versions: VersionsService) {}

  @Get(':id/versions')
  @ApiOperation({
    summary: 'Versions de la fiche et des documents du patient, de la plus récente à la plus ancienne',
  })
  list(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ResourceVersion[]> {
    return this.versions.forPatient(user, id);
  }
}
