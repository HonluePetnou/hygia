import { Body, Controller, Get, Headers, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AudioDto, ValidationDto, parseAudio, parseDraft } from './dto.js';
import type { ScribeSessionView } from './scribe-session.js';
import { ScribeService } from './scribe.service.js';

/** API du scribe de consultation (médecins uniquement). */
@ApiTags('scribe')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
@ApiResponse({ status: 403, description: 'Rôle, équipe de soins ou consentement refusé' })
@UseGuards(JwtAuthGuard)
@Controller('scribe')
export class ScribeController {
  constructor(private readonly service: ScribeService) {}

  @Post('patients/:patientId/sessions')
  @HttpCode(201)
  @ApiOperation({ summary: 'Démarre une séance (vérifie le consentement « enregistrement audio »)' })
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId') patientId: string,
  ): Promise<ScribeSessionView> {
    return this.service.start(user, patientId);
  }

  @Post('sessions/:id/audio')
  @HttpCode(200)
  @ApiOperation({ summary: 'Envoie l’audio ; renvoie le brouillon structuré « à valider »' })
  audio(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AudioDto,
  ): Promise<ScribeSessionView> {
    const { audio, durationSeconds } = parseAudio(body);
    return this.service.upload(user, id, audio, durationSeconds);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Brouillon structuré de la séance' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): ScribeSessionView {
    return this.service.get(user, id);
  }

  @Post('sessions/:id/validation')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Valide (brouillon éventuellement corrigé) : crée les ressources dans Dossiers, supprime l’audio',
  })
  validate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Headers('authorization') authorization: string,
    @Body() body: ValidationDto,
  ): Promise<ScribeSessionView> {
    const corrected = body?.draft === undefined ? undefined : parseDraft(body.draft);
    return this.service.validate(user, id, authorization, corrected);
  }

  @Post('sessions/:id/rejet')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rejette le brouillon : rien n’est créé, l’audio est supprimé' })
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): ScribeSessionView {
    return this.service.reject(user, id);
  }
}
