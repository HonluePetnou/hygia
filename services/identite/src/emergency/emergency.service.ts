import { Inject, Injectable } from '@nestjs/common';
import type { EmergencyAccess } from '@hygia/auth';
import { EVENT_BUS, type EventBus } from '../events/event-bus.js';
import { CLOCK, type Clock } from '../time/clock.js';

/** Durée d'un bris de glace : 4 heures. */
export const BREAK_GLASS_DURATION_MS = 4 * 60 * 60 * 1000;

/** Accès exceptionnel enregistré. */
export interface BreakGlassGrant {
  accountId: string;
  patientId: string;
  motif: string;
  precisions?: string;
  openedAt: string;
  expiresAt: string;
}

/** Bris de glace : ouverture d'un accès de 4 h et notification de la DPO. */
@Injectable()
export class EmergencyService {
  private readonly grants: BreakGlassGrant[] = [];

  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
  ) {}

  /** Ouvre l'accès, publie l'événement destiné à la DPO et renvoie l'accès créé. */
  open(accountId: string, patientId: string, motif: string, precisions?: string): BreakGlassGrant {
    const now = this.clock.now();
    const grant: BreakGlassGrant = {
      accountId,
      patientId,
      motif,
      ...(precisions === undefined ? {} : { precisions }),
      openedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + BREAK_GLASS_DURATION_MS).toISOString(),
    };
    this.grants.push(grant);
    this.bus.publish({
      type: 'bris_de_glace.ouvert',
      occurredAt: grant.openedAt,
      recipient: 'dpo',
      payload: { accountId, patientId, motif, expiresAt: grant.expiresAt },
    });
    return grant;
  }

  /** Accès d'urgence non expirés du compte, tels qu'inscrits dans son jeton. */
  activeFor(accountId: string): EmergencyAccess[] {
    const now = this.clock.now().getTime();
    return this.grants
      .filter((g) => g.accountId === accountId && Date.parse(g.expiresAt) > now)
      .map((g) => ({ patientId: g.patientId, expiresAt: g.expiresAt }));
  }
}
