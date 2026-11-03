import { randomUUID } from 'node:crypto';
import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { ROLES, type Role } from '@hygia/types';
import { summarize, type AccountSummary } from '../accounts/account.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../accounts/account-repository.js';
import { asObject, requiredText } from '../auth/dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../security/password-hasher.js';
import { AdminGuard } from './admin.guard.js';

/** Corps de `POST /comptes`. */
export class CreateAccountDto {
  @ApiProperty() email!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: ROLES }) role!: string;
  @ApiProperty({ description: 'Mot de passe initial (8 caractères minimum)' }) password!: string;
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
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liste des comptes' })
  list(): AccountSummary[] {
    return this.accounts.list().map(summarize);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Crée un compte (double authentification à enrôler à la première connexion)' })
  async create(@Body() body: CreateAccountDto): Promise<AccountSummary> {
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
      passwordHash: await this.hasher.hash(password),
      backupCodeHashes: [],
    };
    this.accounts.save(account);
    return summarize(account);
  }
}
