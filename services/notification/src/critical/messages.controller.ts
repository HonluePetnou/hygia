import { BadRequestException, Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CriticalMessageService, type SendResult } from './critical-message.service.js';

/** Corps de `POST /messages`. */
export interface SendMessageBody {
  patientId: string;
  text: string;
  /** Alerte critique liée : le message attend la validation d'un soignant. */
  alertId?: string;
}

/** Messages du soignant vers le patient. */
@ApiTags('messages')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
@ApiResponse({ status: 403, description: 'Réservé aux soignants' })
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly service: CriticalMessageService) {}

  @Post()
  @ApiOperation({
    summary: 'Envoie un message au patient ; retenu (`blocked`) s’il est lié à une alerte non validée',
  })
  send(@CurrentUser() user: AuthenticatedUser, @Body() body: SendMessageBody): Promise<SendResult> {
    if (user.role !== 'medecin' && user.role !== 'infirmier') {
      throw new ForbiddenException('Réservé aux soignants');
    }
    if (typeof body?.patientId !== 'string' || typeof body.text !== 'string' || body.text === '') {
      throw new BadRequestException('patientId et text requis');
    }
    return this.service.submit(body.patientId, body.text, body.alertId);
  }
}
