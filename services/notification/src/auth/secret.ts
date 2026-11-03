import { timingSafeEqual } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';

/** Jeton d'injection de la configuration validée. */
export const ENV = Symbol('ENV');

/**
 * Vérifie un secret partagé en temps constant.
 *
 * @throws UnauthorizedException si le secret est absent ou différent.
 */
export function requireSecret(provided: string | undefined, expected: string): void {
  const a = Buffer.from(provided ?? '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new UnauthorizedException('Secret invalide');
  }
}
