import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { DuplicatesService, type DuplicateCandidate } from './duplicates.service.js';
import { MergeDto, parseMerge } from './dto.js';
import { MergeService, type MergeResult } from './merge.service.js';

/** Détection, fusion et annulation de fusion des doublons d'identité. */
@ApiTags('doublons')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Jeton absent, invalide ou expiré' })
@ApiResponse({ status: 403, description: 'Accès refusé (rôle ou équipe de soins)' })
@UseGuards(JwtAuthGuard)
@Controller()
export class DoublonsController {
  constructor(
    private readonly duplicates: DuplicatesService,
    private readonly merges: MergeService,
  ) {}

  @Get('doublons')
  @ApiOperation({ summary: 'Doublons probables (score ≥ seuil), du plus similaire au moins similaire' })
  list(@CurrentUser() user: AuthenticatedUser): DuplicateCandidate[] {
    return this.duplicates.list(user);
  }

  @Post('doublons/:id/ignorer')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ignore un doublon : la paire n’est plus proposée' })
  @ApiResponse({ status: 404, description: 'Doublon introuvable' })
  ignore(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): { ignored: true } {
    this.duplicates.ignore(user, id);
    return { ignored: true };
  }

  @Post('patients/:a/fusion/:b')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Fusionne le dossier b dans le dossier a (documents, observations, prescriptions rattachés à a)',
  })
  @ApiResponse({ status: 409, description: 'Dossier déjà fusionné ou version périmée' })
  merge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('a') a: string,
    @Param('b') b: string,
    @Body() body: MergeDto,
  ): Promise<MergeResult> {
    return this.merges.merge(user, a, b, parseMerge(body));
  }

  @Post('fusions/:id/annuler')
  @HttpCode(200)
  @ApiOperation({ summary: 'Annule une fusion (409 si une fiche a changé depuis)' })
  undo(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<MergeResult> {
    return this.merges.undo(user, id);
  }
}
