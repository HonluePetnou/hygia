import {
  createParamDecorator,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { bearerToken, type TokenClaims, type TokenVerifier } from '@hygia/auth';
import type { Request } from 'express';

/** Jeton d'injection de `TokenVerifier`. */
export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

/** Requête enrichie par `JwtAuthGuard`. */
export type AuthenticatedRequest = Request & { claims?: TokenClaims };

/** Exige un jeton `Authorization: Bearer` valide et expose ses revendications. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(request.header('authorization'));
    if (token === undefined) throw new UnauthorizedException('Jeton requis');
    try {
      request.claims = await this.verifier.verify(token);
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }
    return true;
  }
}

/** Injecte les revendications du jeton dans un paramètre de contrôleur. */
export const Claims = createParamDecorator((_data: unknown, context: ExecutionContext): TokenClaims => {
  return context.switchToHttp().getRequest<AuthenticatedRequest>().claims as TokenClaims;
});
