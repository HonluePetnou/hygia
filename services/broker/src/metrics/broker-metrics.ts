import { MetricsRegistry, type MetricsSnapshot } from '@hygia/observability';
import { LatencySeries } from './latency-series.js';

/** Mesures du broker : par service, courbe d'ouverture de dossier, erreurs vues par les clients et bascules. */
export class BrokerMetrics {
  private readonly services = new Map<string, MetricsRegistry>();
  /** p95 de l'ouverture d'un dossier (`GET /api/dossiers/patients/:id`), objectif < 2 s. */
  readonly dossierOpening: LatencySeries;
  private userErrorCount = 0;
  private failoverCount = 0;

  constructor(private readonly now: () => number = Date.now, bucketMs = 10_000) {
    this.dossierOpening = new LatencySeries(bucketMs, 60, now);
  }

  /** Enregistre une réponse du broker pour un service ; un 5xx est une erreur vue par l'utilisateur. */
  record(service: string, status: number, durationMs: number): void {
    let registry = this.services.get(service);
    if (registry === undefined) {
      registry = new MetricsRegistry(service, this.now);
      this.services.set(service, registry);
    }
    registry.record(status, durationMs);
    if (status >= 500) this.userErrorCount += 1;
  }

  /** Une requête a été rejouée sur une autre instance. */
  failover(): void {
    this.failoverCount += 1;
  }

  service(name: string): MetricsSnapshot | undefined {
    return this.services.get(name)?.snapshot();
  }

  get userErrors(): number {
    return this.userErrorCount;
  }

  get failovers(): number {
    return this.failoverCount;
  }
}
