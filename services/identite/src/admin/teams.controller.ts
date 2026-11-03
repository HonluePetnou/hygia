import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { TokenClaims } from '@hygia/auth';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../accounts/account-repository.js';
import { asObject, requiredText } from '../auth/dto.js';
import { Claims, JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TEAM_REPOSITORY, type CareTeam, type TeamRepository } from '../teams/team-repository.js';
import { AdminAudit } from './admin-audit.js';
import { AdminGuard } from './admin.guard.js';

/** Corps de `POST /equipes`. */
export class CreateTeamDto {
  @ApiProperty({ example: 'Cardiologie' }) name!: string;
}

/** Corps de `POST /equipes/:id/membres` et `/membres/retirer`. */
export class AddMemberDto {
  @ApiProperty() accountId!: string;
}

/** Corps de `POST /equipes/:id/patients` et `/patients/retirer`. */
export class AttachPatientDto {
  @ApiProperty() patientId!: string;
}

/** Gestion des équipes de soins (ABAC), réservée à l'administrateur système ; chaque action est journalisée. */
@ApiTags('equipes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('equipes')
export class TeamsController {
  constructor(
    @Inject(TEAM_REPOSITORY) private readonly teams: TeamRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    private readonly audit: AdminAudit,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liste des équipes de soins (membres et patients rattachés)' })
  list(): CareTeam[] {
    return this.teams.list();
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Crée une équipe de soins' })
  create(@Claims() claims: TokenClaims, @Body() body: CreateTeamDto): CareTeam {
    const team = this.teams.create(requiredText(asObject(body), 'name'));
    this.audit.record(claims, { kind: 'creation', resourceType: 'equipe', resourceId: team.id, reason: `création de ${team.name}` });
    return team;
  }

  @Post(':id/membres')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ajoute un compte à l’équipe (effectif au prochain jeton)' })
  addMember(@Claims() claims: TokenClaims, @Param('id') id: string, @Body() body: AddMemberDto): CareTeam {
    const accountId = this.knownAccount(body);
    const team = this.found(this.teams.addMember(id, accountId));
    this.audit.record(claims, this.change(id, `membre ajouté : ${accountId}`));
    return team;
  }

  @Post(':id/membres/retirer')
  @HttpCode(200)
  @ApiOperation({ summary: 'Retire un compte de l’équipe' })
  removeMember(@Claims() claims: TokenClaims, @Param('id') id: string, @Body() body: AddMemberDto): CareTeam {
    const accountId = this.knownAccount(body);
    const team = this.found(this.teams.removeMember(id, accountId));
    this.audit.record(claims, this.change(id, `membre retiré : ${accountId}`));
    return team;
  }

  @Post(':id/patients')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rattache un patient à l’équipe' })
  attachPatient(@Claims() claims: TokenClaims, @Param('id') id: string, @Body() body: AttachPatientDto): CareTeam {
    const patientId = requiredText(asObject(body), 'patientId');
    const team = this.found(this.teams.attachPatient(id, patientId));
    this.audit.record(claims, { ...this.change(id, 'patient rattaché'), patientId });
    return team;
  }

  @Post(':id/patients/retirer')
  @HttpCode(200)
  @ApiOperation({ summary: 'Détache un patient de l’équipe' })
  detachPatient(@Claims() claims: TokenClaims, @Param('id') id: string, @Body() body: AttachPatientDto): CareTeam {
    const patientId = requiredText(asObject(body), 'patientId');
    const team = this.found(this.teams.detachPatient(id, patientId));
    this.audit.record(claims, { ...this.change(id, 'patient détaché'), patientId });
    return team;
  }

  private change(resourceId: string, reason: string) {
    return { kind: 'modification', resourceType: 'equipe', resourceId, reason } as const;
  }

  private knownAccount(body: unknown): string {
    const accountId = requiredText(asObject(body), 'accountId');
    if (!this.accounts.findById(accountId)) throw new NotFoundException('Compte introuvable');
    return accountId;
  }

  private found(team: CareTeam | undefined): CareTeam {
    if (!team) throw new NotFoundException('Équipe introuvable');
    return team;
  }
}
