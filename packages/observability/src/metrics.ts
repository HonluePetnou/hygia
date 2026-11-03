/** Instantané des mesures d'un service. */
export interface MetricsSnapshot {
  service: string;
  /** Secondes depuis le démarrage. */
  uptimeSeconds: number;
  requests: number;
  /** Réponses de statut 5xx. */
  errors: number;
  latency: { count: number; p50Ms: number; p95Ms: number };
}

/** Nombre maximal de durées conservées (fenêtre glissante). */
const WINDOW = 1000;

/** Percentile par rang le plus proche ; 0 si aucun échantillon. */
export function percentile(samples: readonly number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)));
  return sorted[rank - 1] ?? 0;
}

/** Compteurs de requêtes, d'erreurs et latences p50/p95 sur les 1000 dernières requêtes. */
export class MetricsRegistry {
  private readonly durations: number[] = [];
  private requests = 0;
  private errors = 0;
  private readonly startedAt: number;

  constructor(
    private readonly service: string,
    private readonly now: () => number = Date.now,
  ) {
    this.startedAt = now();
  }

  /** Enregistre une réponse : statut HTTP et durée en ms. */
  record(status: number, durationMs: number): void {
    this.requests += 1;
    if (status >= 500) this.errors += 1;
    this.durations.push(durationMs);
    if (this.durations.length > WINDOW) this.durations.shift();
  }

  snapshot(): MetricsSnapshot {
    return {
      service: this.service,
      uptimeSeconds: Math.floor((this.now() - this.startedAt) / 1000),
      requests: this.requests,
      errors: this.errors,
      latency: {
        count: this.durations.length,
        p50Ms: percentile(this.durations, 50),
        p95Ms: percentile(this.durations, 95),
      },
    };
  }
}
