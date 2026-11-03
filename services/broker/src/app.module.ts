import { Module } from '@nestjs/common';
import { loadEnv, type Env } from './config/env.js';
import { RateLimiter } from './limit/rate-limiter.js';
import { BrokerController, RATE_LIMITER } from './proxy/broker.controller.js';
import { ProxyService } from './proxy/proxy.service.js';
import { ServiceRegistry } from './registry/service-registry.js';

export const BROKER_ENV = Symbol('BROKER_ENV');

/** Module racine : registre, limiteur et proxy construits depuis l'environnement. */
@Module({
  controllers: [BrokerController],
  providers: [
    { provide: BROKER_ENV, useFactory: (): Env => loadEnv() },
    { provide: ServiceRegistry, useFactory: (env: Env) => new ServiceRegistry(env.services), inject: [BROKER_ENV] },
    { provide: ProxyService, useFactory: (env: Env) => new ProxyService(env.timeoutMs), inject: [BROKER_ENV] },
    {
      provide: RATE_LIMITER,
      useFactory: (env: Env) => new RateLimiter(env.rateLimit, env.rateWindowMs),
      inject: [BROKER_ENV],
    },
  ],
})
export class AppModule {}
