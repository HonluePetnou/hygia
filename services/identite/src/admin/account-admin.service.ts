import { randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TokenClaims } from '@hygia/auth';
import { ROLES, type Role } from '@hygia/types';
import { summarize, type Account, type AccountSummary } from '../accounts/account.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../accounts/account-repository.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../security/password-hasher.js';
import { TEAM_REPOSITORY, type TeamRepository } from '../teams/team-repository.js';
import { AdminAudit } from './admin-audit.js';

/** Compte tel que l'affiche l'écran d'administration : vue publique et équipes. */
export interface AdminAccountView extends AccountSummary {
  teamIds: string[];
}

/** Résultat d'une invitation ; le mot de passe provisoire n'est affiché qu'une fois. */
export interface InvitationResult {
  account: AdminAccountView;
  temporaryPassword: string;
}

/** Données d'une invitation. */
export interface InvitationInput {
  email: string;
  displayName: string;
  role: string;
  teamId?: string;
}

/** Longueur du mot de passe provisoire (la politique impose 12 caractères). */
const TEMP_PASSWORD_BYTES = 9;

/** Actions d'administration sur les comptes ; chacune est journalisée. */
@Injectable()
export class AccountAdminService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(TEAM_REPOSITORY) private readonly teams: TeamRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly audit: AdminAudit,
  ) {}

  list(): AdminAccountView[] {
    return this.accounts.list().map((account) => this.view(account));
  }

  /** Invite un utilisateur : compte actif, mot de passe provisoire, double authentification à enrôler. */
  async invite(by: TokenClaims, input: InvitationInput): Promise<InvitationResult> {
    const role = this.parseRole(input.role);
    if (this.accounts.findByEmail(input.email)) throw new ConflictException('Adresse déjà utilisée');
    if (input.teamId !== undefined && !this.teams.findById(input.teamId)) {
      throw new NotFoundException('Équipe introuvable');
    }
    const temporaryPassword = randomBytes(TEMP_PASSWORD_BYTES).toString('base64url');
    const account: Account = {
      id: randomUUID(),
      version: 1,
      email: input.email.trim(),
      displayName: input.displayName,
      role,
      active: true,
      passwordHash: await this.hasher.hash(temporaryPassword),
      backupCodeHashes: [],
    };
    this.accounts.save(account);
    if (input.teamId !== undefined) this.teams.addMember(input.teamId, account.id);
    this.audit.record(by, {
      kind: 'creation',
      resourceType: 'compte',
      resourceId: account.id,
      reason: `invitation (${role})${input.teamId === undefined ? '' : ` équipe ${input.teamId}`}`,
    });
    return { account: this.view(account), temporaryPassword };
  }

  changeRole(by: TokenClaims, id: string, roleName: string): AdminAccountView {
    const role = this.parseRole(roleName);
    const account = this.require(id);
    this.refuseSelf(by, account, 'Vous ne pouvez pas modifier votre propre rôle');
    if (account.role === role) return this.view(account);
    const updated = this.update(account, { role });
    this.audit.record(by, this.change(id, `rôle ${account.role} → ${role}`));
    return this.view(updated);
  }

  /** Efface le secret TOTP et les codes de secours : nouvel enrôlement à la prochaine connexion. */
  resetMfa(by: TokenClaims, id: string): AdminAccountView {
    const account = this.require(id);
    const updated: Account = { ...account, version: account.version + 1, backupCodeHashes: [] };
    delete updated.totpSecret;
    this.accounts.save(updated);
    this.audit.record(by, this.change(id, 'double authentification réinitialisée'));
    return this.view(updated);
  }

  setActive(by: TokenClaims, id: string, active: boolean): AdminAccountView {
    const account = this.require(id);
    if (!active) this.refuseSelf(by, account, 'Vous ne pouvez pas désactiver votre propre compte');
    if (account.active === active) return this.view(account);
    const updated = this.update(account, { active });
    this.audit.record(by, this.change(id, active ? 'compte réactivé' : 'compte désactivé'));
    return this.view(updated);
  }

  private view(account: Account): AdminAccountView {
    return { ...summarize(account), teamIds: this.teams.teamIdsOf(account.id) };
  }

  private change(resourceId: string, reason: string) {
    return { kind: 'modification', resourceType: 'compte', resourceId, reason } as const;
  }

  private update(account: Account, changes: Partial<Account>): Account {
    const updated = { ...account, ...changes, version: account.version + 1 };
    this.accounts.save(updated);
    return updated;
  }

  private require(id: string): Account {
    const account = this.accounts.findById(id);
    if (!account) throw new NotFoundException('Compte introuvable');
    return account;
  }

  private parseRole(role: string): Role {
    if (!ROLES.includes(role as Role)) throw new BadRequestException(`Rôle inconnu : ${role}`);
    return role as Role;
  }

  private refuseSelf(by: TokenClaims, account: Account, message: string): void {
    if (by.sub === account.id) throw new BadRequestException(message);
  }
}
