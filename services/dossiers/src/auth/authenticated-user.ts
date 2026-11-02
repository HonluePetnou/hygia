import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Role } from '@hygia/types';
import type { Request } from 'express';

/** Utilisateur identifié par les en-têtes simulés. */
export interface AuthenticatedUser {
  id: string;
  role: Role;
}

/** Requête enrichie par `HeaderAuthGuard`. */
export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

/** Injecte l'utilisateur authentifié dans un paramètre de contrôleur. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user as AuthenticatedUser;
  },
);
