import { ROLES, type Role } from '@hygia/types';

/** Durée de vie d'un jeton d'accès : 30 minutes (section 11 du cahier). */
export const TOKEN_TTL_SECONDS = 30 * 60;

/** Accès d'urgence (bris de glace) actif porté par le jeton. */
export interface EmergencyAccess {
  patientId: string;
  /** Fin de l'accès, ISO 8601 (4 h après l'ouverture). */
  expiresAt: string;
}

/** Contenu vérifié d'un jeton d'accès. */
export interface TokenClaims {
  /** Identifiant du compte (`sub`). */
  sub: string;
  role: Role;
  /** Identifiants des équipes de soins de l'utilisateur. */
  teams: string[];
  /** Accès d'urgence actifs au moment de l'émission. */
  emergency: EmergencyAccess[];
  /** Expiration (secondes epoch). */
  exp: number;
}

/** Vérifie un jeton et renvoie ses revendications ; lève `Error` si invalide ou expiré. */
export interface TokenVerifier {
  verify(token: string): Promise<TokenClaims>;
}

function isEmergency(value: unknown): value is EmergencyAccess {
  if (typeof value !== 'object' || value === null) return false;
  const grant = value as Partial<EmergencyAccess>;
  return typeof grant.patientId === 'string' && typeof grant.expiresAt === 'string';
}

/** Valide la forme des revendications décodées d'un JWT déjà authentifié. */
export function parseClaims(payload: Record<string, unknown>): TokenClaims {
  const { sub, role, teams, emergency, exp } = payload;
  if (typeof sub !== 'string' || sub === '') throw new Error('Jeton sans sujet');
  if (typeof role !== 'string' || !ROLES.includes(role as Role)) throw new Error('Rôle inconnu');
  if (typeof exp !== 'number') throw new Error('Jeton sans expiration');
  const teamIds = Array.isArray(teams) ? teams.filter((t): t is string => typeof t === 'string') : [];
  const grants = Array.isArray(emergency) ? emergency.filter(isEmergency) : [];
  return { sub, role: role as Role, teams: teamIds, emergency: grants, exp };
}

/** Extrait le jeton d'un en-tête `Authorization: Bearer …` ; `undefined` si absent ou mal formé. */
export function bearerToken(header: string | undefined): string | undefined {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  return match?.[1];
}
