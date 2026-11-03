import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import type { TokenClaims } from '@hygia/auth';
import { ROLES, type Role } from '@hygia/types';
import { summarize, type AccountSummary } from '../accounts/account.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../accounts/account-repository.js';
import { asObject, optionalText, requiredText } from '../auth/dto.js';
import { Claims, JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../security/password-hasher.js';
import { AccountAdminService, type AdminAccountView, type InvitationResult } from './account-admin.service.js';
import { AdminAudit } from './admin-audit.js';
import { AdminGuard } from './admin.guard.js';

/** Corps de `POST /comptes`. */
export class CreateAccountDto {
  @ApiProperty() email!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: ROLES }) role!: string;
  @ApiProperty({ description: 'Mot de passe initial (8 caractères minimum)' }) password!: string;
}

/** Corps de `POST /comptes/invitations`. */
export class InviteDto {
  @ApiProperty() email!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: ROLES }) role!: string;
  @ApiPropertyOptional({ description: 'Équipe de soins à rejoindre dès l’invitation' }) teamId?: string;
}

/** Corps de `POST /comptes/:id/role`. */
export class ChangeRoleDto {
  @ApiProperty({ enum: ROLES }) role!: string;
}

/** Gestion des comptes, réservée à l'administrateur système (aucun accès aux données de santé). */
@ApiTags('comptes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('comptes')
export class AccountsController {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly admin: AccountAdminService,
    private readonly audit: AdminAudit,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liste des comptes (rôle, équipes, double authentification, dernière connexion)' })
  list(): AdminAccountView[] {
    return this.admin.list();
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Crée un compte (double authentification à enrôler à la première connexion)' })
  async create(@Claims() claims: TokenClaims, @Body() body: CreateAccountDto): Promise<AccountSummary> {
    const source = asObject(body);
    const email = requiredText(source, 'email').trim();
    const role = requiredText(source, 'role');
    const password = requiredText(source, 'password');
    if (!ROLES.includes(role as Role)) throw new BadRequestException(`Rôle inconnu : ${role}`);
    if (password.length < 8) throw new BadRequestException('Mot de passe trop court (8 caractères)');
    if (this.accounts.findByEmail(email)) throw new ConflictException('Adresse déjà utilisée');
    const account = {
      id: randomUUID(),
      version: 1,
      email,
      displayName: requiredText(source, 'displayName'),
      role: role as Role,
      active: true,
      passwordHash: await this.hasher.hash(password),
      backupCodeHashes: [],
    };
    this.accounts.save(account);
    this.audit.record(claims, {
      kind: 'creation',
      resourceType: 'compte',
      resourceId: account.id,
      reason: `création (${role})`,
    });
    return summarize(account);
  }

  @Post('invitations')
  @HttpCode(201)
  @ApiOperation({ summary: 'Invite un utilisateur : mot de passe provisoire affiché une seule fois' })
  invite(@Claims() claims: TokenClaims, @Body() body: InviteDto): Promise<InvitationResult> {
    const source = asObject(body);
    const teamId = optionalText(source, 'teamId');
    return this.admin.invite(claims, {
      email: requiredText(source, 'email'),
      displayName: requiredText(source, 'displayName'),
      role: requiredText(source, 'role'),
      ...(teamId === undefined ? {} : { teamId }),
    });
  }

  @Post(':id/role')
  @HttpCode(200)
  @ApiOperation({ summary: 'Change le rôle (effectif au prochain jeton)' })
  changeRole(
    @Claims() claims: TokenClaims,
    @Param('id') id: string,
    @Body() body: ChangeRoleDto,
  ): AdminAccountView {
    return this.admin.changeRole(claims, id, requiredText(asObject(body), 'role'));
  }

  @Post(':id/reinitialiser-2fa')
  @HttpCode(200)
  @ApiOperation({ summary: 'Réinitialise la double authentification (nouvel enrôlement à la prochaine connexion)' })
  resetMfa(@Claims() claims: TokenClaims, @Param('id') id: string): AdminAccountView {
    return this.admin.resetMfa(claims, id);
  }

  @Post(':id/desactiver')
  @HttpCode(200)
  @ApiOperation({ summary: 'Désactive le compte (plus de connexion ni de renouvellement de jeton)' })
  deactivate(@Claims() claims: TokenClaims, @Param('id') id: string): AdminAccountView {
    return this.admin.setActive(claims, id, false);
  }

  @Post(':id/reactiver')
  @HttpCode(200)
  @ApiOperation({ summary: 'Réactive un compte désactivé' })
  reactivate(@Claims() claims: TokenClaims, @Param('id') id: string): AdminAccountView {
    return this.admin.setActive(claims, id, true);
  }
}
