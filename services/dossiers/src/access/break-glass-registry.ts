import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from './clock.js';

/** Durée d'un bris de glace : 4 heures. */
export const BREAK_GLASS_DURATION_MS = 4 * 60 * 60 * 1000;

/** Accès exceptionnels ouverts (utilisateur × patient) avec leur expiration. */
@Injectable()
export class BreakGlassRegistry {
  private readonly grants = new Map<string, Date>();

  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  /** Ouvre l'accès et renvoie sa date d'expiration. */
  open(userId: string, patientId: string): Date {
    const expiresAt = new Date(this.clock.now().getTime() + BREAK_GLASS_DURATION_MS);
    this.grants.set(`${userId}:${patientId}`, expiresAt);
    return expiresAt;
  }

  /** Vrai si l'utilisateur a un bris de glace non expiré sur ce patient. */
  isActive(userId: string, patientId: string): boolean {
    const expiresAt = this.grants.get(`${userId}:${patientId}`);
    return expiresAt !== undefined && expiresAt.getTime() > this.clock.now().getTime();
  }
}
