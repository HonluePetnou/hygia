import { Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ReminderService, type ReminderRun } from './reminder.service.js';

/** Déclenchement manuel de la planification des rappels (démo ; sinon périodique). */
@ApiTags('rappels')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
@ApiResponse({ status: 403, description: 'Réservé au secrétariat et aux administrateurs' })
@UseGuards(JwtAuthGuard)
@Controller('rappels')
export class RemindersController {
  constructor(private readonly service: ReminderService) {}

  @Post('executer')
  @ApiOperation({ summary: 'Envoie les rappels des rendez-vous de demain (au plus une fois)' })
  run(@CurrentUser() user: AuthenticatedUser): Promise<ReminderRun> {
    if (user.role !== 'administratif' && user.role !== 'admin') {
      throw new ForbiddenException('Réservé au secrétariat et aux administrateurs');
    }
    return this.service.runDue();
  }
}
