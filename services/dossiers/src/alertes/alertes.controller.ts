import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CLOCK, type Clock } from '../access/clock.js';
import type { AgentPrecision, AlertRecord } from './alert.js';
import { ALERT_STATUS_FILTERS } from './alert.js';
import { AlertesService, type AlertDetail } from './alertes.service.js';
import { DecisionDto, parseDecision, parseIssue, parseStatusFilter } from './dto.js';

/** Alertes IA : liste, raisonnement, décision du soignant et précision des agents. */
@ApiTags('alertes')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Jeton absent, invalide ou expiré' })
@ApiResponse({ status: 403, description: 'Accès refusé (rôle ou équipe de soins)' })
@UseGuards(JwtAuthGuard)
@Controller('alertes')
export class AlertesController {
  constructor(
    private readonly alertes: AlertesService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Alertes des patients de vos équipes, de la plus récente à la plus ancienne' })
  @ApiQuery({ name: 'statut', required: false, enum: ALERT_STATUS_FILTERS })
  list(@CurrentUser() user: AuthenticatedUser, @Query('statut') statut?: string): AlertRecord[] {
    return this.alertes.list(user, parseStatusFilter(statut));
  }

  @Get('precision')
  @ApiOperation({ summary: 'Précision de chaque agent sur 30 jours (acceptées / décidées)' })
  precision(@CurrentUser() user: AuthenticatedUser): AgentPrecision[] {
    return this.alertes.precision(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’une alerte : raisonnement, sources, proposition, précision de l’agent' })
  @ApiResponse({ status: 404, description: 'Alerte introuvable' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): AlertDetail {
    return this.alertes.get(user, id);
  }

  @Post(':id/decision')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Enregistre la décision du soignant (accepter, accepter_notifier, rejeter) ; ne modifie jamais le dossier',
  })
  @ApiResponse({ status: 400, description: 'Décision inconnue, ou justification absente en cas de rejet' })
  @ApiResponse({ status: 409, description: 'Alerte déjà traitée' })
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: DecisionDto,
  ): AlertDetail {
    return this.alertes.decide(user, id, parseDecision(body));
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Dépose une alerte produite par un agent (compte de service `admin`)' })
  ingest(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>): AlertRecord {
    return this.alertes.ingest(user, parseIssue(body, this.clock.now()));
  }
}
