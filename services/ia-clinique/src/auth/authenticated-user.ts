import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { EmergencyAccess } from '@hygia/auth';
import type { Role } from '@hygia/types';
import type { Request } from 'express';

/** Utilisateur identifié par son jeton JWT. */
export interface AuthenticatedUser {
  id: string;
  role: Role;
  /** Équipes de soins du jeton. */
  teams: string[];
  /** Accès d'urgence (bris de glace) du jeton. */
  emergency: EmergencyAccess[];
}

/** Requête enrichie par `JwtAuthGuard`. */
export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

/** Injecte l'utilisateur authentifié dans un paramètre de contrôleur. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user as AuthenticatedUser;
  },
);
