import { makeAutoObservable, runInAction } from 'mobx';
import { createTranslator, type Locale, type Translate } from '@hygia/i18n';
import type { Role } from '@hygia/types';
import type { AuthGateway } from './gateways.js';
import { GatewayError } from './http-client.js';
import { DEMO_MFA_CODE, InMemoryAuthGateway } from './in-memory-auth-gateway.js';
import type {
  AuthSession,
  Identity,
  LocaleSource,
  LoginChallenge,
  MfaEnrollment,
  SecondFactor,
} from './types.js';

export { DEMO_MFA_CODE };

/** Étapes de connexion (`enroll` : première configuration de l'application d'authentification). */
export type SessionStep = 'credentials' | 'enroll' | 'code' | 'backupCodes' | 'authenticated';

/** Clés de libellé de chaque rôle. */
const ROLE_KEYS: Record<Role, string> = {
  medecin: 'role.doctor',
  infirmier: 'role.nurse',
  administratif: 'role.administrative',
  analyste: 'role.analyst',
  patient: 'role.patient',
  admin: 'role.admin',
  auditeur: 'role.auditor',
};

type ErrorKey = 'login.error' | 'mfa.error' | 'login.unavailable';

/** Options de session. */
export interface SessionOptions {
  /** Service Identité ; par défaut, la connexion hors ligne (code fixe, aucun jeton réel). */
  auth?: AuthGateway;
  /** Identifiant utilisateur avant connexion (hors ligne : praticien de démonstration). */
  userId?: string;
  /** Nom affiché dans les salutations (par défaut : « Dr Nana »). */
  displayName?: string;
  role?: Role;
  locale?: Locale;
  /** Code attendu à la seconde étape, pour la connexion hors ligne uniquement. */
  expectedCode?: string;
}

/** Connexion en deux temps (mot de passe puis TOTP ou code de secours), jeton, rôle et langue. */
export class SessionViewModel implements LocaleSource {
  step: SessionStep = 'credentials';
  email = '';
  displayName: string;
  role: Role;
  locale: Locale;
  /** Clé de libellé de l'erreur courante, absente si tout va bien. */
  errorKey: ErrorKey | null = null;
  /** Vrai pendant un appel au service Identité. */
  submitting = false;
  /** Vrai si l'utilisateur saisit un code de secours plutôt qu'un code TOTP. */
  backupMode = false;
  /** Secret et QR code à enrôler (étape `enroll`). */
  enrollment: MfaEnrollment | null = null;
  /** Codes de secours à noter (étape `backupCodes`), affichés une seule fois. */
  backupCodes: string[] = [];

  private userId: string;
  private token: string | undefined;
  private challenge: LoginChallenge | null = null;
  private readonly auth: AuthGateway;

  constructor(options: SessionOptions = {}) {
    this.userId = options.userId ?? '00000000-0000-4000-8000-020000000001';
    this.displayName = options.displayName ?? 'Dr Nana';
    this.role = options.role ?? 'medecin';
    this.locale = options.locale ?? 'fr';
    this.auth =
      options.auth ??
      new InMemoryAuthGateway(
        { id: this.userId, displayName: this.displayName, role: this.role },
        options.expectedCode ?? DEMO_MFA_CODE,
      );
    makeAutoObservable<SessionViewModel, 'userId' | 'token' | 'challenge' | 'auth'>(
      this,
      { userId: false, token: false, challenge: false, auth: false },
      { autoBind: true },
    );
  }

  /** Fonction de traduction de la langue courante. */
  get t(): Translate {
    return createTranslator(this.locale);
  }

  get isAuthenticated(): boolean {
    return this.step === 'authenticated';
  }

  get identity(): Identity {
    return this.token === undefined
      ? { userId: this.userId, role: this.role }
      : { userId: this.userId, role: this.role, token: this.token };
  }

  get roleLabel(): string {
    return this.t(ROLE_KEYS[this.role]);
  }

  get errorMessage(): string | null {
    return this.errorKey ? this.t(this.errorKey) : null;
  }

  /** Première étape : e-mail et mot de passe, vérifiés par le service Identité. */
  async submitCredentials(email: string, password: string): Promise<boolean> {
    if (email.trim() === '' || password === '') {
      this.errorKey = 'login.error';
      return false;
    }
    return this.run('login.error', async () => {
      const challenge = await this.auth.login(email.trim(), password);
      const enrollment = challenge.mfa === 'enroll' ? await this.auth.enroll(challenge.challengeId) : null;
      runInAction(() => {
        this.challenge = challenge;
        this.enrollment = enrollment;
        this.email = email.trim();
        this.step = enrollment ? 'enroll' : 'code';
      });
    });
  }

  /** Seconde étape : code à 6 chiffres (TOTP). */
  submitCode(code: string): Promise<boolean> {
    if (!/^\d{6}$/.test(code)) {
      this.errorKey = 'mfa.error';
      return Promise.resolve(false);
    }
    return this.verify({ code });
  }

  /** Seconde étape avec un code de secours (usage unique). */
  submitBackupCode(backupCode: string): Promise<boolean> {
    if (backupCode.trim() === '') {
      this.errorKey = 'mfa.error';
      return Promise.resolve(false);
    }
    return this.verify({ backupCode: backupCode.trim() });
  }

  /** Après l'enrôlement : l'utilisateur a noté ses codes de secours, la session s'ouvre. */
  acknowledgeBackupCodes(): void {
    this.backupCodes = [];
    this.step = 'authenticated';
  }

  /** Bascule entre code TOTP et code de secours. */
  toggleBackupMode(): void {
    this.backupMode = !this.backupMode;
    this.errorKey = null;
  }

  /** Remplace le jeton (renouvellement, ou jeton portant un accès d'urgence). */
  setToken(token: string): void {
    this.token = token;
  }

  signOut(): void {
    this.step = 'credentials';
    this.email = '';
    this.errorKey = null;
    this.token = undefined;
    this.challenge = null;
    this.enrollment = null;
    this.backupCodes = [];
    this.backupMode = false;
  }

  setRole(role: Role): void {
    this.role = role;
  }

  setLocale(locale: Locale): void {
    this.locale = locale;
  }

  /** Bascule FR ↔ EN. */
  toggleLocale(): void {
    this.locale = this.locale === 'fr' ? 'en' : 'fr';
  }

  private verify(factor: SecondFactor): Promise<boolean> {
    const challenge = this.challenge;
    if (challenge === null) {
      this.errorKey = 'mfa.error';
      return Promise.resolve(false);
    }
    return this.run('mfa.error', async () => {
      const session = await this.auth.verify(challenge.challengeId, factor);
      runInAction(() => this.open(session));
    });
  }

  private open(session: AuthSession): void {
    this.userId = session.user.id;
    this.displayName = session.user.displayName;
    this.role = session.user.role;
    this.token = session.accessToken;
    this.enrollment = null;
    this.challenge = null;
    this.backupCodes = session.backupCodes ?? [];
    this.step = this.backupCodes.length > 0 ? 'backupCodes' : 'authenticated';
  }

  /** Exécute un appel : 401/400 → `rejected`, autre échec → service indisponible. */
  private async run(rejected: ErrorKey, action: () => Promise<void>): Promise<boolean> {
    this.submitting = true;
    this.errorKey = null;
    try {
      await action();
      return true;
    } catch (error) {
      const refused = error instanceof GatewayError && (error.status === 401 || error.status === 400);
      runInAction(() => {
        this.errorKey = refused ? rejected : 'login.unavailable';
      });
      return false;
    } finally {
      runInAction(() => {
        this.submitting = false;
      });
    }
  }
}
