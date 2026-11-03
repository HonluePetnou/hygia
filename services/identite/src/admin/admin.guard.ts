import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';

/** Réserve une route au rôle `admin` (à placer après `JwtAuthGuard`). */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const claims = context.switchToHttp().getRequest<AuthenticatedRequest>().claims;
    if (claims?.role !== 'admin') throw new ForbiddenException('Réservé à l’administrateur système');
    return true;
  }
}
