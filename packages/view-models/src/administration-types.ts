import type { Role } from '@hygia/types';

/** Compte tel que le renvoie le service Identité à l'administrateur. */
export interface AdminAccount {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  /** Double authentification enrôlée. */
  mfaEnrolled: boolean;
  active: boolean;
  /** ISO 8601, ou `null` si jamais connecté. */
  lastLoginAt: string | null;
  teamIds: string[];
}

/** Équipe de soins : membres et patients rattachés (identifiants seulement). */
export interface AdminTeam {
  id: string;
  version: number;
  name: string;
  memberIds: string[];
  patientIds: string[];
}

/** Contenu de l'écran : comptes et équipes. */
export interface AdministrationData {
  accounts: AdminAccount[];
  teams: AdminTeam[];
}

/** Données d'une invitation. */
export interface InvitationInput {
  email: string;
  displayName: string;
  role: Role;
  teamId?: string;
}

/** Résultat d'une invitation ; le mot de passe provisoire n'est montré qu'une fois. */
export interface InvitationResult {
  account: AdminAccount;
  temporaryPassword: string;
}

/** Règles de la carte « Politique de sécurité » (valeurs fixées par le cahier des charges). */
export const SECURITY_POLICY = {
  mfaRequired: true,
  sessionMinutes: 30,
  breakGlassHours: 4,
  passwordLength: 12,
} as const;
