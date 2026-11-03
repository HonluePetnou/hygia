import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { TokenClaims } from '@hygia/auth';
import { summarize, type AccountSummary } from '../accounts/account.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../accounts/account-repository.js';
import {
  AuthService,
  type EnrollmentData,
  type LoginResult,
  type SessionResult,
} from './auth.service.js';
import {
  EnrollDto,
  LoginDto,
  VerifyDto,
  asObject,
  optionalText,
  requiredText,
} from './dto.js';
import { Claims, JwtAuthGuard } from './jwt-auth.guard.js';
import { SessionTokens, type IssuedToken } from './session-tokens.js';

/** Connexion en deux étapes (mot de passe puis TOTP) et renouvellement du jeton. */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: SessionTokens,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
  ) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Étape 1 : e-mail et mot de passe' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides' })
  login(@Body() body: LoginDto): Promise<LoginResult> {
    const source = asObject(body);
    return this.auth.login(requiredText(source, 'email'), requiredText(source, 'password'));
  }

  @Post('mfa/enroll')
  @HttpCode(200)
  @ApiOperation({ summary: 'Enrôlement TOTP : secret, URI otpauth et QR code' })
  enroll(@Body() body: EnrollDto): Promise<EnrollmentData> {
    return this.auth.startEnrollment(requiredText(asObject(body), 'challengeId'));
  }

  @Post('mfa/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Étape 2 : code TOTP ou code de secours ; renvoie le jeton de 30 min' })
  @ApiResponse({ status: 401, description: 'Code incorrect, expiré ou étape expirée' })
  verify(@Body() body: VerifyDto): Promise<SessionResult> {
    const source = asObject(body);
    return this.auth.verifySecondFactor(
      requiredText(source, 'challengeId'),
      optionalText(source, 'code'),
      optionalText(source, 'backupCode'),
    );
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Nouveau jeton (équipes et accès d’urgence à jour) tant que le jeton courant est valide' })
  async refresh(@Claims() claims: TokenClaims): Promise<IssuedToken> {
    return this.tokens.issueFor(this.account(claims));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Compte du jeton courant' })
  me(@Claims() claims: TokenClaims): AccountSummary {
    return summarize(this.account(claims));
  }

  private account(claims: TokenClaims) {
    const account = this.accounts.findById(claims.sub);
    if (!account) throw new UnauthorizedException('Compte inconnu');
    return account;
  }
}
