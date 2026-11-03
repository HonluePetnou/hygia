import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { SearchResponse } from '@hygia/fhir';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SearchDto, parseSearch } from './dto.js';
import { SearchService } from './search.service.js';

/** Recherche de dossiers par critères ou en langage naturel. */
@ApiTags('recherche')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Jeton absent, invalide ou expiré' })
@ApiResponse({ status: 403, description: 'Rôle sans accès aux données de santé' })
@UseGuards(JwtAuthGuard)
@Controller('recherche')
export class RechercheController {
  constructor(private readonly search: SearchService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Recherche multicritère : une requête libre est transformée en filtres (diagnostic, âge, dernière visite, valeur biologique, sexe, mot-clé), ou des filtres sont fournis directement ; chaque dossier affiché est audité',
  })
  @ApiResponse({ status: 400, description: 'Requête ou filtres invalides' })
  run(@CurrentUser() user: AuthenticatedUser, @Body() body: SearchDto): SearchResponse {
    return this.search.search(user, parseSearch(body));
  }
}
