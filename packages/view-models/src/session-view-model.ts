import { makeAutoObservable } from 'mobx';
import { createTranslator, type Locale, type Translate } from '@hygia/i18n';
import type { Role } from '@hygia/types';
import type { Identity, LocaleSource } from './types.js';

/** Code de démonstration du second facteur (simulé). */
export const DEMO_MFA_CODE = '481516';

/** Étapes de connexion. */
export type SessionStep = 'credentials' | 'code' | 'authenticated';

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

/** Options de session. */
export interface SessionOptions {
  /** Identifiant utilisateur transmis au broker (par défaut : praticien de démonstration). */
  userId?: string;
  role?: Role;
  locale?: Locale;
  /** Code attendu à la seconde étape. */
  expectedCode?: string;
}

/** Connexion en deux temps (identifiants puis code à 6 chiffres simulé), rôle et langue. */
export class SessionViewModel implements LocaleSource {
  step: SessionStep = 'credentials';
  email = '';
  role: Role;
  locale: Locale;
  /** Clé de libellé de l'erreur courante, absente si tout va bien. */
  errorKey: 'login.error' | 'mfa.error' | null = null;

  private readonly userId: string;
  private readonly expectedCode: string;

  constructor(options: SessionOptions = {}) {
    this.userId = options.userId ?? '00000000-0000-4000-8000-020000000001';
    this.role = options.role ?? 'medecin';
    this.locale = options.locale ?? 'fr';
    this.expectedCode = options.expectedCode ?? DEMO_MFA_CODE;
    makeAutoObservable<SessionViewModel, 'userId' | 'expectedCode'>(
      this,
      { userId: false, expectedCode: false },
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
    return { userId: this.userId, role: this.role };
  }

  get roleLabel(): string {
    return this.t(ROLE_KEYS[this.role]);
  }

  get errorMessage(): string | null {
    return this.errorKey ? this.t(this.errorKey) : null;
  }

  /** Première étape : e-mail et mot de passe non vides. */
  submitCredentials(email: string, password: string): boolean {
    const valid = email.trim() !== '' && password !== '';
    this.errorKey = valid ? null : 'login.error';
    if (valid) {
      this.email = email.trim();
      this.step = 'code';
    }
    return valid;
  }

  /** Seconde étape : code à 6 chiffres. */
  submitCode(code: string): boolean {
    const valid = /^\d{6}$/.test(code) && code === this.expectedCode;
    this.errorKey = valid ? null : 'mfa.error';
    if (valid) this.step = 'authenticated';
    return valid;
  }

  signOut(): void {
    this.step = 'credentials';
    this.email = '';
    this.errorKey = null;
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
}
