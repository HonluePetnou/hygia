import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { bearerToken, type TokenVerifier } from '@hygia/auth';
import type { AuthenticatedRequest } from './authenticated-user.js';

/** Jeton d'injection de `TokenVerifier`. */
export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

/**
 * Exige un jeton JWT `Authorization: Bearer` signé par le service Identité (clé publique JWKS)
 * et non expiré ; rôle et équipes viennent du jeton.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(request.header('authorization'));
    if (token === undefined) throw new UnauthorizedException('Jeton Bearer requis');
    try {
      const claims = await this.verifier.verify(token);
      request.user = { id: claims.sub, role: claims.role, teams: claims.teams };
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }
    return true;
  }
}
