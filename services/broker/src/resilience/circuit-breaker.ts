/** État d'un disjoncteur : fermé (nominal), ouvert (instance retirée) ou semi-ouvert (nouvel essai). */
export type BreakerState = 'closed' | 'open' | 'half-open';

/**
 * Disjoncteur d'une instance : s'ouvre après `threshold` échecs consécutifs, retire l'instance
 * pendant `cooldownMs`, puis autorise un nouvel essai (semi-ouvert). Un succès le referme ; un
 * échec en semi-ouvert le rouvre aussitôt.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | undefined;

  constructor(
    private readonly threshold: number,
    private readonly cooldownMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get state(): BreakerState {
    if (this.openedAt === undefined) return 'closed';
    return this.now() - this.openedAt >= this.cooldownMs ? 'half-open' : 'open';
  }

  /** L'instance peut-elle recevoir une requête ? */
  allows(): boolean {
    return this.state !== 'open';
  }

  onSuccess(): void {
    this.failures = 0;
    this.openedAt = undefined;
  }

  onFailure(): void {
    this.failures += 1;
    if (this.state === 'half-open' || this.failures >= this.threshold) this.openedAt = this.now();
  }
}
