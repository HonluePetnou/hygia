import type { AuditLog } from './audit-log.js';
import type { VerifyResult } from './types.js';

/** Reçoit l'alerte de rupture de chaîne (production : service Notification, DPO). */
export interface ChainAlertSink {
  chainBroken(brokenAt: number, checkedAt: Date): void;
}

/** Dernier résultat de vérification. */
export interface ChainStatus {
  result: VerifyResult;
  checkedAt: string;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Vérification quotidienne de la chaîne. L'horloge est injectée : `tick()` ne fait rien avant
 * l'échéance (un minuteur du serveur l'appelle régulièrement), `runNow()` force une vérification.
 */
export class ChainVerifier {
  private last: ChainStatus | undefined;
  private nextRunAt: number | undefined;

  constructor(
    private readonly log: AuditLog,
    private readonly alerts: ChainAlertSink,
    private readonly now: () => Date,
    private readonly intervalMs: number = DAY_MS,
  ) {}

  get status(): ChainStatus | undefined {
    return this.last;
  }

  /** Vérifie la chaîne, mémorise le résultat et alerte en cas de rupture. */
  runNow(): ChainStatus {
    const at = this.now();
    const result = this.log.verify();
    this.last = { result, checkedAt: at.toISOString() };
    this.nextRunAt = at.getTime() + this.intervalMs;
    if (!result.intact) this.alerts.chainBroken(result.brokenAt, at);
    return this.last;
  }

  /** À appeler régulièrement : lance la vérification si l'échéance est passée. */
  tick(): ChainStatus | undefined {
    if (this.nextRunAt !== undefined && this.now().getTime() < this.nextRunAt) return undefined;
    return this.runNow();
  }
}
