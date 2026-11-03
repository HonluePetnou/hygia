import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ConflictService } from './conflict.service.js';
import { parseSyncRequest } from './sync-dto.js';
import { SyncService, type SyncResponse } from './sync.service.js';
import type { StoredConflict } from './sync-store.js';

function requireCaregiver(user: AuthenticatedUser): void {
  if (user.role !== 'medecin' && user.role !== 'infirmier') {
    throw new ForbiddenException('Réservé aux soignants');
  }
}

/** Synchronisation des terminaux hors ligne et arbitrage des conflits. */
@ApiTags('synchronisation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(
    private readonly sync: SyncService,
    private readonly conflicts: ConflictService,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Synchronise un lot de changements (clé d’idempotence par changement)',
    description:
      'Corps : { nodeId, changes: Change[], clocks: { [resourceId]: horloge } }. Un lot rejoué ne crée aucun doublon.',
  })
  push(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown): SyncResponse {
    requireCaregiver(user);
    return this.sync.sync(user, parseSyncRequest(body));
  }

  @Get('conflits')
  @ApiOperation({ summary: 'Conflits en attente d’arbitrage' })
  open(@CurrentUser() user: AuthenticatedUser): StoredConflict[] {
    requireCaregiver(user);
    return this.sync.openConflicts();
  }

  @Post('conflits/:id/arbitrage')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Arbitre un conflit',
    description: 'Corps : { choice: "local" | "remote" | "manual", value? } ; tracé dans l’audit.',
  })
  arbitrate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { choice?: unknown; value?: unknown } | undefined,
  ): StoredConflict {
    requireCaregiver(user);
    return this.conflicts.resolve(user, id, body?.choice, body?.value);
  }
}
