import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Inject,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { TokenClaims } from '@hygia/auth';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../accounts/account-repository.js';
import { BreakGlassDto, asObject, optionalText, requiredText } from '../auth/dto.js';
import { Claims, JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SessionTokens } from '../auth/session-tokens.js';
import { EmergencyService } from './emergency.service.js';

/** Réponse de `POST /bris-de-glace`. */
export interface BreakGlassResult {
  patientId: string;
  /** Fin de l'accès (4 h). */
  expiresAt: string;
  /** Nouveau jeton portant l'accès d'urgence (valable 30 min, renouvelable). */
  accessToken: string;
  tokenExpiresAt: string;
}

/** Bris de glace : accès exceptionnel de 4 h à un dossier, notifié à la DPO. */
@ApiTags('bris-de-glace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bris-de-glace')
export class EmergencyController {
  constructor(
    private readonly emergency: EmergencyService,
    private readonly tokens: SessionTokens,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Ouvre un accès de 4 h et notifie la DPO (événement sur le bus)' })
  @ApiResponse({ status: 403, description: 'Réservé aux médecins et infirmiers' })
  async open(@Claims() claims: TokenClaims, @Body() body: BreakGlassDto): Promise<BreakGlassResult> {
    if (claims.role !== 'medecin' && claims.role !== 'infirmier') {
      throw new ForbiddenException('Le bris de glace est réservé aux soignants');
    }
    const account = this.accounts.findById(claims.sub);
    if (!account) throw new UnauthorizedException('Compte inconnu');
    const source = asObject(body);
    const grant = this.emergency.open(
      account.id,
      requiredText(source, 'patientId'),
      requiredText(source, 'motif'),
      optionalText(source, 'precisions'),
    );
    const token = await this.tokens.issueFor(account);
    return {
      patientId: grant.patientId,
      expiresAt: grant.expiresAt,
      accessToken: token.accessToken,
      tokenExpiresAt: token.expiresAt,
    };
  }
}
