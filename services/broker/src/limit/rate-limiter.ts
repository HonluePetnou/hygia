/** Limiteur à fenêtre fixe, par clé (utilisateur). Protection simple de type WAF. */
export class RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Enregistre un appel ; renvoie `false` si la clé a dépassé sa limite dans la fenêtre. */
  tryAcquire(key: string): boolean {
    const t = this.now();
    if (this.windows.size > 10_000) this.evictExpired(t);
    const current = this.windows.get(key);
    if (current === undefined || t - current.start >= this.windowMs) {
      this.windows.set(key, { start: t, count: 1 });
      return true;
    }
    current.count += 1;
    return current.count <= this.limit;
  }

  private evictExpired(t: number): void {
    for (const [key, w] of this.windows) if (t - w.start >= this.windowMs) this.windows.delete(key);
  }
}
