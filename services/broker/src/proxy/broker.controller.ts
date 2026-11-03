import { randomUUID } from 'node:crypto';
import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import { bearerToken, type TokenVerifier } from '@hygia/auth';
import type { Request, Response } from 'express';
import { RateLimiter } from '../limit/rate-limiter.js';
import { ServiceRegistry } from '../registry/service-registry.js';
import { ProxyService } from './proxy.service.js';

export const RATE_LIMITER = Symbol('RATE_LIMITER');
/** Jeton d'injection de `TokenVerifier`. */
export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

/** Routes du service Identité accessibles sans jeton (connexion, enrôlement, clé publique). */
const PUBLIC_ROUTES = new Set(['identite:auth/login', 'identite:auth/mfa/enroll', 'identite:auth/mfa/verify', 'identite:.well-known/jwks.json']);
const PREFIX = '/api/';

/** Point d'entrée unique : `/api/<service>/...` est transmis au service désigné par son nom. */
@Controller()
export class BrokerController {
  constructor(
    private readonly registry: ServiceRegistry,
    private readonly proxy: ProxyService,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
  ) {}

  /** Vérifie le jeton JWT, limite le débit, localise le service puis transmet. */
  @All('api/*path')
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    const incoming = req.headers['x-correlation-id'];
    const correlationId = typeof incoming === 'string' && incoming !== '' ? incoming : randomUUID();
    res.setHeader('x-correlation-id', correlationId);

    const rest = req.originalUrl.slice(PREFIX.length);
    const cut = rest.search(/[/?]/);
    const name = cut === -1 ? rest : rest.slice(0, cut);
    const path = cut === -1 ? '/' : rest.slice(cut).replace(/^\?/, '/?');
    const route = `${name}:${path.split('?')[0]?.replace(/^\/+|\/+$/g, '') ?? ''}`;

    let userId = `ip:${req.ip ?? 'inconnue'}`;
    if (!PUBLIC_ROUTES.has(route)) {
      const token = bearerToken(req.headers.authorization);
      try {
        if (token === undefined) throw new Error('jeton absent');
        userId = (await this.verifier.verify(token)).sub;
      } catch {
        res.status(401).json({ statusCode: 401, message: 'Jeton valide requis (Authorization: Bearer)', correlationId });
        return;
      }
    }
    if (!this.limiter.tryAcquire(userId)) {
      res.setHeader('retry-after', '60');
      res.status(429).json({ statusCode: 429, message: 'Trop de requêtes', correlationId });
      return;
    }
    // Les en-têtes d'identité simulés n'ont plus cours : seul le jeton fait foi.
    delete req.headers['x-user-id'];
    delete req.headers['x-user-role'];
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
