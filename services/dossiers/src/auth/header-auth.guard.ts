import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ROLES, type Role } from '@hygia/types';
import type { AuthenticatedRequest } from './authenticated-user.js';

/**
 * Authentification SIMULÉE pour la démo : l'identité vient des en-têtes `x-user-id` et
 * `x-user-role`, sans aucune vérification de signature.
 *
 * Sera remplacée par Cognito (jeton JWT validé par le broker) ; seul ce garde changera.
 */
@Injectable()
export class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const id = request.header('x-user-id');
    const role = request.header('x-user-role');
    if (!id || !role) {
      throw new UnauthorizedException('En-têtes x-user-id et x-user-role requis');
    }
    if (!ROLES.includes(role as Role)) {
      throw new UnauthorizedException(`Rôle inconnu : ${role}`);
    }
    request.user = { id, role: role as Role };
    return true;
  }
}
