import { Controller, ForbiddenException, Get, HttpCode, Inject, NotFoundException, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import { bearerToken, type TokenVerifier } from '@hygia/auth';
import type { Request } from 'express';
import { ExperimentService } from '../faults/experiment-service.js';
import { TOKEN_VERIFIER } from '../proxy/broker.controller.js';
import { SupervisionService, type SupervisionView } from './supervision.service.js';

/**
 * Supervision et module de pannes (rôle `admin`, RF26 et RF27). Réponses propres au broker :
 * ces routes ne sont jamais transmises à un service.
 */
@Controller('api/supervision')
export class SupervisionController {
  constructor(
    private readonly supervision: SupervisionService,
    private readonly experiments: ExperimentService,
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
  ) {}

  /** État des services (zones, p95), courbe de latence, expériences et exercice en cours. */
  @Get()
  async view(@Req() req: Request): Promise<SupervisionView> {
    await this.requireAdmin(req);
    return this.supervision.view();
  }

  /** Lance une expérience : `zone-cut`, `instance-stop`, `latency` ou `llm-down`. */
  @Post('experiments/:id/start')
  @HttpCode(200)
  async start(@Req() req: Request, @Param('id') id: string): Promise<SupervisionView> {
    await this.requireAdmin(req);
    if (!this.experiments.start(id)) throw new NotFoundException(`Expérience inconnue : ${id}`);
    return this.supervision.view();
  }

  /** Arrête une expérience. */
  @Post('experiments/:id/stop')
  @HttpCode(200)
  async stop(@Req() req: Request, @Param('id') id: string): Promise<SupervisionView> {
    await this.requireAdmin(req);
    if (!this.experiments.stop(id)) throw new NotFoundException(`Expérience inconnue : ${id}`);
    return this.supervision.view();
  }

  /** « Arrêter l'exercice » : retire toutes les pannes simulées. */
  @Post('exercise/stop')
  @HttpCode(200)
  async stopAll(@Req() req: Request): Promise<SupervisionView> {
    await this.requireAdmin(req);
    this.experiments.stopAll();
    return this.supervision.view();
  }

  private async requireAdmin(req: Request): Promise<void> {
    const token = bearerToken(req.headers.authorization);
    if (token === undefined) throw new UnauthorizedException('Jeton valide requis (Authorization: Bearer)');
    const claims = await this.verifier.verify(token).catch(() => {
      throw new UnauthorizedException('Jeton valide requis (Authorization: Bearer)');
    });
    if (claims.role !== 'admin') throw new ForbiddenException('Rôle admin requis');
  }
}
