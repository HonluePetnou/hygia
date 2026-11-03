import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { APPOINTMENT_STORE, type AppointmentStore } from './appointments.js';
import { CLOCK, type Clock } from './reminder.service.js';

/** Prochain rendez-vous affiché dans le bandeau du portail patient. */
export interface NextAppointment {
  id: string;
  /** Début, ISO 8601 (UTC). */
  startsAt: string;
  clinician?: string;
  service?: string;
  site?: string;
}

/** Rendez-vous du patient connecté (portail, RF21). */
@ApiTags('rendez-vous')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
@ApiResponse({ status: 403, description: 'Réservé au patient' })
@UseGuards(JwtAuthGuard)
@Controller('rendez-vous')
export class AppointmentsController {
  constructor(
    @Inject(APPOINTMENT_STORE) private readonly appointments: AppointmentStore,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get('prochain')
  @ApiOperation({ summary: 'Prochain rendez-vous du patient connecté' })
  @ApiResponse({ status: 404, description: 'Aucun rendez-vous à venir' })
  next(@CurrentUser() user: AuthenticatedUser): NextAppointment {
    if (user.role !== 'patient') throw new ForbiddenException('Réservé au patient');
    const now = this.clock().toISOString();
    const next = this.appointments
      .all()
      .filter((a) => a.patientId === user.id && a.startsAt >= now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
    if (next === undefined) throw new NotFoundException('Aucun rendez-vous à venir');
    return {
      id: next.id,
      startsAt: next.startsAt,
      ...(next.clinician ? { clinician: next.clinician } : {}),
      ...(next.service ? { service: next.service } : {}),
      ...(next.site ? { site: next.site } : {}),
    };
  }
}
