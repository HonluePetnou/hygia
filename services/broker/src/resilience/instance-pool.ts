import type { ServiceInstance } from '../config/env.js';
import { CircuitBreaker, type BreakerState } from './circuit-breaker.js';

/**
 * Répartition de charge (tourniquet) entre les instances d'un service, avec un disjoncteur par
 * instance : une instance qui ne répond plus est retirée de la rotation puis réessayée.
 */
export class InstancePool {
  private readonly breakers = new Map<string, CircuitBreaker>();
  private readonly cursors = new Map<string, number>();

  constructor(
    private readonly threshold: number,
    private readonly cooldownMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Prochaine instance à essayer, hors `excluded` (déjà essayées pour cette requête) et hors
   * instances au disjoncteur ouvert ; `undefined` s'il n'en reste aucune.
   */
  next(service: string, instances: readonly ServiceInstance[], excluded: ReadonlySet<string>): ServiceInstance | undefined {
    const start = this.cursors.get(service) ?? 0;
    for (let offset = 0; offset < instances.length; offset += 1) {
      const candidate = instances[(start + offset) % instances.length];
      if (candidate === undefined || excluded.has(candidate.id) || !this.breaker(candidate.id).allows()) continue;
      this.cursors.set(service, (start + offset + 1) % instances.length);
      return candidate;
    }
    return undefined;
  }

  success(instanceId: string): void {
    this.breaker(instanceId).onSuccess();
  }

  failure(instanceId: string): void {
    this.breaker(instanceId).onFailure();
  }

  state(instanceId: string): BreakerState {
    return this.breaker(instanceId).state;
  }

  private breaker(instanceId: string): CircuitBreaker {
    let breaker = this.breakers.get(instanceId);
    if (breaker === undefined) {
      breaker = new CircuitBreaker(this.threshold, this.cooldownMs, this.now);
      this.breakers.set(instanceId, breaker);
    }
    return breaker;
  }
}
