import { SERVICE_NAMES, type Zone } from '../config/env.js';
import type { ExerciseStatus, ExperimentService, ExperimentStatus } from '../faults/experiment-service.js';
import type { FaultState } from '../faults/fault-state.js';
import type { BrokerMetrics } from '../metrics/broker-metrics.js';
import type { LatencyPoint } from '../metrics/latency-series.js';
import type { ServiceRegistry } from '../registry/service-registry.js';
import type { InstancePool } from '../resilience/instance-pool.js';

/** Jeton d'injection de `HealthProbe`. */
export const HEALTH_PROBE = Symbol('HEALTH_PROBE');

/** Sonde `/health` d'une instance (adresse de base) ; `false` si elle ne répond pas. */
export type HealthProbe = (baseUrl: URL) => Promise<boolean>;

/** Objectif de latence p95 de l'ouverture d'un dossier (section 7.4 : < 2 s). */
export const SLO_MS = 2000;
/** Au-delà de ce p95, un service est signalé « dégradé » (orange). */
export const SLOW_MS = 500;

export type ServiceHealth = 'ok' | 'degraded' | 'down' | 'unconfigured';

export interface InstanceView {
  id: string;
  zone: Zone;
  up: boolean;
}

export interface ServiceView {
  id: string;
  status: ServiceHealth;
  instances: InstanceView[];
  /** p95 mesuré par le broker (ms) ; `null` sans requête. */
  p95Ms: number | null;
  requests: number;
  errors: number;
}

/** Contenu de `GET /api/supervision`. */
export interface SupervisionView {
  generatedAt: string;
  services: ServiceView[];
  latency: { objectiveMs: number; sloMet: boolean; points: LatencyPoint[] };
  experiments: ExperimentStatus[];
  exercise: ExerciseStatus;
}

/** Sonde HTTP par défaut : `GET /health` avec un délai d'une seconde. */
export const httpHealthProbe: HealthProbe = async (baseUrl) => {
  try {
    const url = new URL(`${baseUrl.pathname.replace(/\/+$/, '')}/health`, baseUrl);
    return (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok;
  } catch {
    return false;
  }
};

/** Assemble l'état de santé des services, la courbe de latence et les expériences. */
export class SupervisionService {
  constructor(
    private readonly registry: ServiceRegistry,
    private readonly pool: InstancePool,
    private readonly faults: FaultState,
    private readonly metrics: BrokerMetrics,
    private readonly experiments: ExperimentService,
    private readonly probe: HealthProbe,
  ) {}

  async view(): Promise<SupervisionView> {
    const services = await Promise.all(SERVICE_NAMES.map((name) => this.service(name)));
    const points = this.metrics.dossierOpening.points();
    const last = points[points.length - 1];
    return {
      generatedAt: new Date().toISOString(),
      services,
      latency: { objectiveMs: SLO_MS, sloMet: last === undefined || last.p95Ms < SLO_MS, points },
      experiments: this.experiments.list(),
      exercise: this.experiments.exercise(),
    };
  }

  private async service(name: string): Promise<ServiceView> {
    const instances = await Promise.all(
      this.registry.instances(name).map(async (instance): Promise<InstanceView> => {
        const blocked = this.faults.isDown(instance) || this.pool.state(instance.id) === 'open';
        return { id: instance.id, zone: instance.zone, up: !blocked && (await this.probe(instance.url)) };
      }),
    );
    const snapshot = this.metrics.service(name);
    const p95Ms = snapshot === undefined ? null : snapshot.latency.p95Ms;
    const up = instances.filter((i) => i.up).length;
    const status: ServiceHealth =
      instances.length === 0
        ? 'unconfigured'
        : up === 0
          ? 'down'
          : up < instances.length || (p95Ms ?? 0) > SLOW_MS
            ? 'degraded'
            : 'ok';
    return { id: name, status, instances, p95Ms, requests: snapshot?.requests ?? 0, errors: snapshot?.errors ?? 0 };
  }
}
