import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TokenIssuer } from '@hygia/auth';
import { TOKEN_ISSUER } from './session-tokens.js';

/** Publication de la clé publique de signature. */
@ApiTags('jwks')
@Controller('.well-known')
export class JwksController {
  constructor(@Inject(TOKEN_ISSUER) private readonly issuer: TokenIssuer) {}

  @Get('jwks.json')
  @ApiOperation({ summary: 'Clé publique (JWKS) pour vérifier les jetons, sans appel au service' })
  jwks(): ReturnType<TokenIssuer['jwks']> {
    return this.issuer.jwks();
  }
}
