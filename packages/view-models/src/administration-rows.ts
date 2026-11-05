import { localParts } from '@hygia/i18n';
import type { Role } from '@hygia/types';
import type { AdminAccount, AdminTeam } from './administration-types.js';
import { ROLE_KEYS } from './session-view-model.js';
import type { LocaleSource } from './types.js';

/** Ligne du tableau des utilisateurs. */
export interface AccountRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleLabel: string;
  teamNames: string[];
  mfaEnrolled: boolean;
  active: boolean;
  lastLoginLabel: string;
}

/** Carte d'une équipe de soins. */
export interface TeamCard {
  id: string;
  name: string;
  members: { id: string; name: string }[];
  /** Comptes actifs pas encore membres, proposés à l'ajout. */
  candidates: { id: string; name: string }[];
  patientIds: string[];
}

/** `03/11/2026 09:12` (français) ou `2026-11-03 09:12` (anglais), à l'heure du Cameroun ; sans connexion : « Jamais ». */
export function formatLastLogin(iso: string | null, i18n: LocaleSource): string {
  if (iso === null) return i18n.t('administration.neverLoggedIn');
  const d = localParts(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  const time = `${p(d.hours)}:${p(d.minutes)}`;
  const date =
    i18n.locale === 'fr'
      ? `${p(d.day)}/${p(d.month)}/${d.year}`
      : `${d.year}-${p(d.month)}-${p(d.day)}`;
  return `${date} ${time}`;
}

/** Lignes du tableau : un compte, son rôle libellé, ses équipes. */
export function accountRows(accounts: AdminAccount[], teams: AdminTeam[], i18n: LocaleSource): AccountRow[] {
  const nameOf = new Map(teams.map((team) => [team.id, team.name]));
  return accounts.map((a) => ({
    id: a.id,
    name: a.displayName,
    email: a.email,
    role: a.role,
    roleLabel: i18n.t(ROLE_KEYS[a.role]),
    teamNames: a.teamIds.map((id) => nameOf.get(id)).filter((n): n is string => n !== undefined),
    mfaEnrolled: a.mfaEnrolled,
    active: a.active,
    lastLoginLabel: formatLastLogin(a.lastLoginAt, i18n),
  }));
}

/** Cartes des équipes avec leurs membres et les comptes encore ajoutables. */
export function teamCards(accounts: AdminAccount[], teams: AdminTeam[]): TeamCard[] {
  const name = (id: string) => accounts.find((a) => a.id === id)?.displayName ?? id;
  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    members: team.memberIds.map((id) => ({ id, name: name(id) })),
    candidates: accounts
      .filter((a) => a.active && !team.memberIds.includes(a.id))
      .map((a) => ({ id: a.id, name: a.displayName })),
    patientIds: team.patientIds,
  }));
}
