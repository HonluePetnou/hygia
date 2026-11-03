import type { Role } from '@hygia/types';

/** Compte utilisateur (jamais de mot de passe ni de secret TOTP en clair). */
export interface Account {
  /** UUID stable. */
  id: string;
  /** Numéro de version (contrôle optimiste). */
  version: number;
  email: string;
  displayName: string;
  role: Role;
  /** Hachage bcrypt du mot de passe. */
  passwordHash: string;
  /** Secret TOTP (base32) ; absent tant que l'enrôlement n'est pas confirmé. */
  totpSecret?: string;
  /** Hachages des codes de secours encore utilisables. */
  backupCodeHashes: string[];
  /** Un compte désactivé ne peut plus ouvrir de session. */
  active: boolean;
  /** Dernière connexion réussie (ISO 8601). */
  lastLoginAt?: string;
}

/** Vue publique d'un compte. */
export interface AccountSummary {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  mfaEnrolled: boolean;
  active: boolean;
  lastLoginAt: string | null;
}

/** Projette un compte vers sa vue publique. */
export function summarize(account: Account): AccountSummary {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    role: account.role,
    mfaEnrolled: account.totpSecret !== undefined,
    active: account.active,
    lastLoginAt: account.lastLoginAt ?? null,
  };
}
