import type { Request, Response } from 'express';
import type { ServiceInstance } from '../config/env.js';
import type { FaultState } from '../faults/fault-state.js';
import type { BrokerMetrics } from '../metrics/broker-metrics.js';
import type { InstancePool } from '../resilience/instance-pool.js';
import type { ServiceRegistry } from '../registry/service-registry.js';
import { readBody } from './read-body.js';
import type { ForwardResult, ProxyService } from './proxy.service.js';

/** En-tête posé par le broker (jamais par le client) pour simuler un modèle de langage indisponible. */
export const FAULT_HEADER = 'x-hygia-fault';
/** Valeur de `FAULT_HEADER` quand le modèle de langage est déclaré indisponible. */
export const LLM_UNAVAILABLE = 'llm-unavailable';

const IDEMPOTENT = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);
const OPENING_A_RECORD = /^\/patients\/[^/?]+(\?.*)?$/;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Choisit une instance (tourniquet + disjoncteur), applique les pannes simulées, transmet, et
 * rejoue la requête sur l'autre instance si la première ne répond pas : l'utilisateur ne voit
 * une erreur que si toutes les instances ont échoué.
 */
export class Dispatcher {
  constructor(
    private readonly registry: ServiceRegistry,
    private readonly proxy: ProxyService,
    private readonly pool: InstancePool,
    private readonly faults: FaultState,
    private readonly metrics: BrokerMetrics,
  ) {}

  /** Le service est-il déclaré (au moins une instance) ? */
  knows(service: string): boolean {
    return this.registry.instances(service).length > 0;
  }

  /** @throws RangeError si le corps à rejouer dépasse la limite. */
  async dispatch(service: string, req: Request, res: Response, path: string, correlationId: string): Promise<void> {
    const instances = this.registry.instances(service);
    delete req.headers[FAULT_HEADER];
    if (service === 'ia-clinique' && this.faults.llmUnavailable) req.headers[FAULT_HEADER] = LLM_UNAVAILABLE;
    const replayable = instances.length > 1 && !['GET', 'HEAD'].includes(req.method);
    const body = replayable ? await readBody(req) : undefined;
    const started = Date.now();
    const tried = new Set<string>();
    let reason = 'aucune instance disponible';
    for (;;) {
      const instance = this.pool.next(service, instances, tried);
      if (instance === undefined) break;
      tried.add(instance.id);
      const delay = this.faults.latencyFor(service);
      if (delay > 0) await sleep(delay);
      const result = await this.attempt(instance, req, res, path, correlationId, body);
      if (result.ok) {
        this.pool.success(instance.id);
        if (result.status >= 502) this.pool.failure(instance.id);
        this.finish(service, req, path, result.status, Date.now() - started, tried.size > 1);
        return;
      }
      this.pool.failure(instance.id);
      reason = result.reason;
      if (!IDEMPOTENT.has(req.method) && !result.notDelivered) break;
    }
    this.finish(service, req, path, 503, Date.now() - started, false);
    res.status(503).json({ statusCode: 503, message: `Service indisponible : ${service}`, reason, correlationId });
  }

  private attempt(
    instance: ServiceInstance,
    req: Request,
    res: Response,
    path: string,
    correlationId: string,
    body: Buffer | undefined,
  ): Promise<ForwardResult> {
    if (this.faults.isDown(instance)) {
      return Promise.resolve({ ok: false, reason: 'instance arrêtée (panne simulée)', notDelivered: true });
    }
    return this.proxy.forward(req, res, instance.url, path, correlationId, body);
  }

  private finish(service: string, req: Request, path: string, status: number, ms: number, failedOver: boolean): void {
    this.metrics.record(service, status, ms);
    if (failedOver) this.metrics.failover();
    if (service === 'dossiers' && req.method === 'GET' && OPENING_A_RECORD.test(path)) this.metrics.dossierOpening.record(ms);
  }
}
