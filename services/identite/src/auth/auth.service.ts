import { randomBytes } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { summarize, type Account, type AccountSummary } from '../accounts/account.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../accounts/account-repository.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../security/password-hasher.js';
import { TotpService } from '../security/totp.service.js';
import { CLOCK, type Clock } from '../time/clock.js';
import { ChallengeStore, type Challenge } from './challenge-store.js';
import { SessionTokens, type IssuedToken } from './session-tokens.js';

/** Résultat de la première étape. */
export interface LoginResult {
  challengeId: string;
  /** `verify` : saisir le code ; `enroll` : enrôler d'abord l'application d'authentification. */
  mfa: 'verify' | 'enroll';
}

/** Données d'enrôlement de l'application d'authentification. */
export interface EnrollmentData {
  secret: string;
  otpauthUri: string;
  /** QR code de l'URI (`data:image/png;base64,…`). */
  qrCode: string;
}

/** Résultat de la seconde étape. */
export interface SessionResult extends IssuedToken {
  user: AccountSummary;
  /** Codes de secours, présents seulement juste après un enrôlement (affichés une seule fois). */
  backupCodes?: string[];
}

const BACKUP_CODE_COUNT = 8;

/** Connexion en deux étapes : mot de passe, puis code TOTP ou code de secours. */
@Injectable()
export class AuthService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly totp: TotpService,
    private readonly challenges: ChallengeStore,
    private readonly tokens: SessionTokens,
  ) {}

  /** Étape 1 : vérifie le mot de passe. Même message d'erreur pour un compte inconnu. */
  async login(email: string, password: string): Promise<LoginResult> {
    const account = this.accounts.findByEmail(email);
    const valid = account !== undefined && (await this.hasher.verify(password, account.passwordHash));
    if (!account || !valid) throw new UnauthorizedException('Identifiants invalides');
    const challenge = this.challenges.create(account.id);
    return { challengeId: challenge.id, mfa: account.totpSecret ? 'verify' : 'enroll' };
  }

  /** Génère le secret et le QR code d'un compte non enrôlé (confirmé à l'étape 2). */
  async startEnrollment(challengeId: string): Promise<EnrollmentData> {
    const { challenge, account } = this.resolve(challengeId);
    if (account.totpSecret) throw new UnauthorizedException('Double authentification déjà configurée');
    const secret = this.totp.newSecret();
    challenge.pendingSecret = secret;
    const otpauthUri = this.totp.uri(secret, account.email);
    return { secret, otpauthUri, qrCode: await this.totp.qrCode(otpauthUri) };
  }

  /** Étape 2 : code TOTP (ou code de secours) ; émet le jeton d'accès de 30 minutes. */
  async verifySecondFactor(
    challengeId: string,
    code?: string,
    backupCode?: string,
  ): Promise<SessionResult> {
    const { challenge, account } = this.resolve(challengeId);
    challenge.attempts += 1;
    let current = account;
    let backupCodes: string[] | undefined;
    if (challenge.pendingSecret !== undefined) {
      if (!(await this.totp.check(challenge.pendingSecret, code ?? '', this.clock.now()))) {
        throw new UnauthorizedException('Code incorrect ou expiré');
      }
      backupCodes = this.newBackupCodes();
      current = await this.confirmEnrollment(account, challenge.pendingSecret, backupCodes);
    } else if (backupCode !== undefined) {
      current = await this.consumeBackupCode(account, backupCode);
    } else if (!account.totpSecret || !(await this.totp.check(account.totpSecret, code ?? '', this.clock.now()))) {
      throw new UnauthorizedException('Code incorrect ou expiré');
    }
    this.challenges.delete(challenge.id);
    const token = await this.tokens.issueFor(current);
    return { ...token, user: summarize(current), ...(backupCodes ? { backupCodes } : {}) };
  }

  private resolve(challengeId: string): { challenge: Challenge; account: Account } {
    const challenge = this.challenges.find(challengeId);
    const account = challenge && this.accounts.findById(challenge.accountId);
    if (!challenge || !account) throw new UnauthorizedException('Connexion expirée, recommencez');
    return { challenge, account };
  }

  private newBackupCodes(): string[] {
    return Array.from({ length: BACKUP_CODE_COUNT }, () => randomBytes(5).toString('hex'));
  }

  private async confirmEnrollment(account: Account, secret: string, codes: string[]): Promise<Account> {
    const updated: Account = {
      ...account,
      version: account.version + 1,
      totpSecret: secret,
      backupCodeHashes: await Promise.all(codes.map((c) => this.hasher.hash(c))),
    };
    this.accounts.save(updated);
    return updated;
  }

  /** Vérifie un code de secours et le retire (usage unique). */
  private async consumeBackupCode(account: Account, code: string): Promise<Account> {
    for (const hash of account.backupCodeHashes) {
      if (await this.hasher.verify(code.trim(), hash)) {
        const updated: Account = {
          ...account,
          version: account.version + 1,
          backupCodeHashes: account.backupCodeHashes.filter((h) => h !== hash),
        };
        this.accounts.save(updated);
        return updated;
      }
    }
    throw new UnauthorizedException('Code de secours invalide');
  }
}
