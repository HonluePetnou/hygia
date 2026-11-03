import { randomUUID } from 'node:crypto';
import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RateLimiter } from '../limit/rate-limiter.js';
import { ServiceRegistry } from '../registry/service-registry.js';
import { ProxyService } from './proxy.service.js';

export const RATE_LIMITER = Symbol('RATE_LIMITER');
const PREFIX = '/api/';

/** Point d'entrée unique : `/api/<service>/...` est transmis au service désigné par son nom. */
@Controller()
export class BrokerController {
  constructor(
    private readonly registry: ServiceRegistry,
    private readonly proxy: ProxyService,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  /** Authentifie (en-têtes d'identité), limite le débit, localise le service puis transmet. */
  @All('api/*path')
  handle(@Req() req: Request, @Res() res: Response): void {
    const incoming = req.headers['x-correlation-id'];
    const correlationId = typeof incoming === 'string' && incoming !== '' ? incoming : randomUUID();
    res.setHeader('x-correlation-id', correlationId);

    const userId = req.headers['x-user-id'];
    if (typeof userId !== 'string' || userId === '') {
      res.status(401).json({ statusCode: 401, message: 'Identité requise (x-user-id)', correlationId });
      return;
    }
    if (!this.limiter.tryAcquire(userId)) {
      res.setHeader('retry-after', '60');
      res.status(429).json({ statusCode: 429, message: 'Trop de requêtes', correlationId });
      return;
    }

    const rest = req.originalUrl.slice(PREFIX.length);
    const cut = rest.search(/[/?]/);
    const name = cut === -1 ? rest : rest.slice(0, cut);
    const path = cut === -1 ? '/' : rest.slice(cut).replace(/^\?/, '/?');
    const target = this.registry.resolve(name);
    if (target === undefined) {
      res.status(404).json({ statusCode: 404, message: `Service inconnu : ${name}`, correlationId });
      return;
    }
    this.proxy.forward(req, res, target, path, correlationId, (reason) => {
      res.status(503).json({ statusCode: 503, message: `Service indisponible : ${name}`, reason, correlationId });
    });
  }
}
