import { timingSafeEqual } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';

/** Vérifie en temps constant la clé des appels internes entre services. */
export function requireInternalKey(provided: string | undefined, expected: string): void {
  const a = Buffer.from(provided ?? '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw new UnauthorizedException('Clé interne invalide');
}
