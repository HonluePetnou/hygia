import { percentile } from '@hygia/observability';

/** Point de la courbe : p95 des durées d'une tranche de temps. */
export interface LatencyPoint {
  /** Début de la tranche (ISO 8601). */
  at: string;
  p95Ms: number;
  count: number;
}

/** Série temporelle de latences : un p95 par tranche de `bucketMs`, sur les `size` dernières tranches. */
export class LatencySeries {
  private readonly buckets = new Map<number, number[]>();

  constructor(
    private readonly bucketMs: number = 10_000,
    private readonly size: number = 60,
    private readonly now: () => number = Date.now,
  ) {}

  record(durationMs: number): void {
    const key = Math.floor(this.now() / this.bucketMs);
    const samples = this.buckets.get(key) ?? [];
    samples.push(durationMs);
    this.buckets.set(key, samples);
    for (const old of [...this.buckets.keys()]) if (old <= key - this.size) this.buckets.delete(old);
  }

  /** Points des tranches non vides, du plus ancien au plus récent. */
  points(): LatencyPoint[] {
    return [...this.buckets.entries()]
      .sort(([a], [b]) => a - b)
      .map(([key, samples]) => ({
        at: new Date(key * this.bucketMs).toISOString(),
        p95Ms: percentile(samples, 95),
        count: samples.length,
      }));
  }
}
