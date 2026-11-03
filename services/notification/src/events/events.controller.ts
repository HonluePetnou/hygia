import { BadRequestException, Body, Controller, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ENV, requireSecret } from '../auth/secret.js';
import type { Env } from '../config/env.js';
import { EVENT_TYPES, EventsService, type NotificationEvent } from './events.service.js';

/** Réception des événements publiés par les autres services (appel interne). */
@ApiTags('evenements')
@Controller('events')
export class EventsController {
  constructor(
    private readonly service: EventsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({ summary: 'Consomme un événement (alerte.notification, analyse.terminee…)' })
  @ApiBody({ schema: { type: 'object', description: '{ type, ...champs de l’événement }' } })
  @ApiResponse({ status: 401, description: 'En-tête x-internal-key absent ou invalide' })
  async publish(
    @Headers('x-internal-key') key: string | undefined,
    @Body() event: NotificationEvent,
  ): Promise<{ accepted: true }> {
    requireSecret(key, this.env.internalKey);
    if (!EVENT_TYPES.includes(event?.type)) throw new BadRequestException('type d’événement inconnu');
    await this.service.handle(event);
    return { accepted: true };
  }
}
