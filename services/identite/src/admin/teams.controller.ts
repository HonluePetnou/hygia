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
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../accounts/account-repository.js';
import { asObject, requiredText } from '../auth/dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TEAM_REPOSITORY, type CareTeam, type TeamRepository } from '../teams/team-repository.js';
import { AdminGuard } from './admin.guard.js';

/** Corps de `POST /equipes`. */
export class CreateTeamDto {
  @ApiProperty({ example: 'Cardiologie' }) name!: string;
}

/** Corps de `POST /equipes/:id/membres`. */
export class AddMemberDto {
  @ApiProperty() accountId!: string;
}

/** Gestion des équipes de soins (ABAC), réservée à l'administrateur système. */
@ApiTags('equipes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('equipes')
export class TeamsController {
  constructor(
    @Inject(TEAM_REPOSITORY) private readonly teams: TeamRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liste des équipes de soins' })
  list(): CareTeam[] {
    return this.teams.list();
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Crée une équipe de soins' })
  create(@Body() body: CreateTeamDto): CareTeam {
    return this.teams.create(requiredText(asObject(body), 'name'));
  }

  @Post(':id/membres')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ajoute un compte à l’équipe (effectif au prochain jeton)' })
  addMember(@Param('id') id: string, @Body() body: AddMemberDto): CareTeam {
    const accountId = requiredText(asObject(body), 'accountId');
    if (!this.accounts.findById(accountId)) throw new NotFoundException('Compte introuvable');
    const team = this.teams.addMember(id, accountId);
    if (!team) throw new NotFoundException('Équipe introuvable');
    return team;
  }
}
