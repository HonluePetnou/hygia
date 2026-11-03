import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { remoteVerifier } from '@hygia/auth';
import { createObservability } from '@hygia/observability';
import { loadEnv, type Env } from './config/env.js';
import { ExperimentService } from './faults/experiment-service.js';
import { FaultState } from './faults/fault-state.js';
import { RateLimiter } from './limit/rate-limiter.js';
import { BrokerMetrics } from './metrics/broker-metrics.js';
import { BrokerController, RATE_LIMITER, TOKEN_VERIFIER } from './proxy/broker.controller.js';
import { Dispatcher } from './proxy/dispatcher.js';
import { ProxyService } from './proxy/proxy.service.js';
import { ServiceRegistry } from './registry/service-registry.js';
import { InstancePool } from './resilience/instance-pool.js';
import { SupervisionController } from './supervision/supervision.controller.js';
import { HEALTH_PROBE, SupervisionService, httpHealthProbe } from './supervision/supervision.service.js';

export const BROKER_ENV = Symbol('BROKER_ENV');

/**
 * Module racine : registre multi-instances, disjoncteurs, pannes simulées et proxy construits
 * depuis l'environnement. `SupervisionController` précède `BrokerController` (route plus précise).
 */
@Module({
  controllers: [SupervisionController, BrokerController],
  providers: [
    { provide: BROKER_ENV, useFactory: (): Env => loadEnv() },
    { provide: ServiceRegistry, useFactory: (env: Env) => new ServiceRegistry(env.services), inject: [BROKER_ENV] },
    { provide: ProxyService, useFactory: (env: Env) => new ProxyService(env.timeoutMs), inject: [BROKER_ENV] },
    {
      provide: InstancePool,
      useFactory: (env: Env) => new InstancePool(env.breakerThreshold, env.breakerCooldownMs),
      inject: [BROKER_ENV],
    },
    { provide: FaultState, useFactory: () => new FaultState() },
    { provide: BrokerMetrics, useFactory: () => new BrokerMetrics() },
    {
      provide: ExperimentService,
      useFactory: (faults: FaultState, metrics: BrokerMetrics) =>
        new ExperimentService(faults, () => ({ userErrors: metrics.userErrors, failovers: metrics.failovers })),
      inject: [FaultState, BrokerMetrics],
    },
    {
      provide: Dispatcher,
      useFactory: (r: ServiceRegistry, p: ProxyService, pool: InstancePool, f: FaultState, m: BrokerMetrics) =>
        new Dispatcher(r, p, pool, f, m),
      inject: [ServiceRegistry, ProxyService, InstancePool, FaultState, BrokerMetrics],
    },
    { provide: HEALTH_PROBE, useValue: httpHealthProbe },
    {
      provide: SupervisionService,
      useFactory: (
        r: ServiceRegistry,
        pool: InstancePool,
        f: FaultState,
        m: BrokerMetrics,
        e: ExperimentService,
        probe: typeof httpHealthProbe,
      ) => new SupervisionService(r, pool, f, m, e, probe),
      inject: [ServiceRegistry, InstancePool, FaultState, BrokerMetrics, ExperimentService, HEALTH_PROBE],
    },
    {
      provide: RATE_LIMITER,
      useFactory: (env: Env) => new RateLimiter(env.rateLimit, env.rateWindowMs),
      inject: [BROKER_ENV],
    },
    { provide: TOKEN_VERIFIER, useFactory: (env: Env) => remoteVerifier(env.jwksUrl), inject: [BROKER_ENV] },
  ],
})
export class AppModule implements NestModule {
  /** `/health`, `/metrics` et journal `x-correlation-id` du broker lui-même. */
  configure(consumer: MiddlewareConsumer): void {
    const log = process.env['NODE_ENV'] === 'test' ? () => undefined : undefined;
    const { middleware } = createObservability({ service: 'broker', ...(log ? { log } : {}) });
    consumer.apply(middleware).forRoutes('*path');
  }
}
