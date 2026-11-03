import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../time/clock.js';

/** Validité d'une étape de connexion : 5 minutes. */
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
/** Nombre d'essais de second facteur autorisés par étape. */
export const MAX_ATTEMPTS = 5;

/** Première étape franchie, en attente du second facteur. */
export interface Challenge {
  id: string;
  accountId: string;
  expiresAt: number;
  attempts: number;
  /** Secret TOTP en cours d'enrôlement, pas encore confirmé. */
  pendingSecret?: string;
}

/** Étapes de connexion en cours (mémoire du processus). */
@Injectable()
export class ChallengeStore {
  private readonly challenges = new Map<string, Challenge>();

  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  create(accountId: string): Challenge {
    const challenge: Challenge = {
      id: randomUUID(),
      accountId,
      expiresAt: this.clock.now().getTime() + CHALLENGE_TTL_MS,
      attempts: 0,
    };
    this.challenges.set(challenge.id, challenge);
    return challenge;
  }

  /** Étape encore valable, ou `undefined` (inconnue, expirée ou essais épuisés). */
  find(id: string): Challenge | undefined {
    const challenge = this.challenges.get(id);
    if (challenge === undefined) return undefined;
    if (challenge.expiresAt <= this.clock.now().getTime() || challenge.attempts >= MAX_ATTEMPTS) {
      this.challenges.delete(id);
      return undefined;
    }
    return challenge;
  }

  delete(id: string): void {
    this.challenges.delete(id);
  }
}
