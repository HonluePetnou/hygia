import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeController,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { requireInternalKey } from '../auth/internal-key.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { Env } from '../config/env.js';
import { ENV } from '../config/env-token.js';
import type { Consent, ConsentSheet } from './consent.js';
import { ConsentsService } from './consents.service.js';
import { LanguageDto, UpdateConsentDto, parseLanguage, parsePurpose, parseUpdate } from './dto.js';

/** Consentements du patient connecté (portail, RF21). */
@ApiTags('consentements')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Jeton absent, invalide ou expiré' })
@ApiResponse({ status: 403, description: 'Réservé au patient concerné' })
@UseGuards(JwtAuthGuard)
@Controller('patients/:id')
export class ConsentsController {
  constructor(private readonly service: ConsentsService) {}

  @Get('consents')
  @ApiOperation({ summary: 'Consentements (finalités, dates, révocation) et langue du patient' })
  sheet(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): ConsentSheet {
    return this.service.sheet(user, id);
  }

  @Put('consents/:purpose')
  @ApiOperation({
    summary: 'Accorde ou révoque une finalité (le consentement aux soins est irrévocable)',
  })
  @ApiResponse({ status: 409, description: 'Version périmée' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('purpose') purpose: string,
    @Body() body: UpdateConsentDto,
  ): Consent {
    const { granted, version } = parseUpdate(body);
    return this.service.update(user, id, parsePurpose(purpose), granted, version);
  }

  @Put('language')
  @ApiOperation({ summary: 'Enregistre la langue d’interface du patient (fr ou en)' })
  language(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: LanguageDto,
  ): { language: string } {
    return { language: this.service.setLanguage(user, id, parseLanguage(body)) };
  }
}

/** Interrogation interne des autres services (clé `x-internal-key`), hors documentation publique. */
@ApiExcludeController()
@Controller('internal/consents')
export class InternalConsentsController {
  constructor(
    private readonly service: ConsentsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get(':patientId/:purpose')
  @HttpCode(200)
  granted(
    @Headers('x-internal-key') key: string | undefined,
    @Param('patientId') patientId: string,
    @Param('purpose') purpose: string,
  ): { granted: boolean } {
    requireInternalKey(key, this.env.internalKey);
    return { granted: this.service.isGranted(patientId, parsePurpose(purpose)) };
  }
}
