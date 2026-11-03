import { BadRequestException, Body, Controller, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ENV, requireSecret } from '../auth/secret.js';
import type { Env } from '../config/env.js';
import {
  WhatsAppWebhookService,
  type InboundWhatsAppMessage,
  type WebhookOutcome,
} from './whatsapp-webhook.service.js';

/** Webhook entrant WhatsApp (bac à sable). */
@ApiTags('whatsapp')
@Controller('webhooks')
export class WhatsAppController {
  constructor(
    private readonly service: WhatsAppWebhookService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post('whatsapp')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Message entrant : réponse « 1 » / « 2 » ou photo transmise à la chaîne d’ingestion',
  })
  @ApiBody({
    description: '{ from, type: "text" | "image", text?, image?: { fileName?, base64 } }',
    schema: { type: 'object' },
  })
  @ApiResponse({ status: 401, description: 'En-tête x-webhook-token absent ou invalide' })
  async receive(
    @Headers('x-webhook-token') token: string | undefined,
    @Body() body: InboundWhatsAppMessage,
  ): Promise<{ outcome: WebhookOutcome }> {
    requireSecret(token, this.env.webhookToken);
    const valid =
      typeof body?.from === 'string' &&
      ((body.type === 'text' && typeof body.text === 'string') ||
        (body.type === 'image' && typeof body.image?.base64 === 'string'));
    if (!valid) throw new BadRequestException('message WhatsApp invalide');
    return { outcome: await this.service.handle(body) };
  }
}
