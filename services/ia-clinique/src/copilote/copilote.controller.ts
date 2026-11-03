import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CopiloteService } from './copilote.service.js';
import type { CopiloteAnswer } from './copilote.types.js';
import { WORD_DELAY_MS, streamAnswer } from './sse.js';

const MAX_QUESTION_LENGTH = 1000;

function parseQuestion(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException('Une question non vide est requise');
  }
  if (value.length > MAX_QUESTION_LENGTH) {
    throw new BadRequestException(`Question trop longue (${MAX_QUESTION_LENGTH} caractères max)`);
  }
  return value.trim();
}

/** API du copilote : réponses sourcées uniquement à partir du dossier du patient. */
@ApiTags('copilote')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'En-têtes d’identité absents ou invalides' })
@ApiResponse({ status: 403, description: 'Accès refusé (rôle ou équipe de soins)' })
@UseGuards(JwtAuthGuard)
@Controller('copilote')
export class CopiloteController {
  constructor(
    private readonly service: CopiloteService,
    @Inject(WORD_DELAY_MS) private readonly wordDelayMs: number,
  ) {}

  @Post(':patientId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Pose une question ; la réponse cite ses sources ou dit qu’elle n’en a pas',
  })
  ask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId') patientId: string,
    @Body() body: { question?: unknown } | undefined,
  ): Promise<CopiloteAnswer> {
    return this.service.ask(user, patientId, parseQuestion(body?.question));
  }

  @Get(':patientId/flux')
  @ApiOperation({ summary: 'Même réponse en Server-Sent Events (évènements word, sources, done)' })
  async stream(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId') patientId: string,
    @Query('q') q: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.service.ask(user, patientId, parseQuestion(q));
    await streamAnswer(response, result, this.wordDelayMs);
  }
}
