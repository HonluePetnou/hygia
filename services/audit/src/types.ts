import type { Role } from '@hygia/types';

/** Actions journalisées. */
export const AUDIT_ACTIONS = [
  'lecture',
  'modification',
  'creation',
  'bris_de_glace',
  'question_copilote',
  'alerte_ia',
  'import_document',
  'export',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Données fournies par l'appelant pour journaliser un accès. */
export interface AuditEntryInput {
  actor: string;
  role: Role;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  patientId: string;
  reason: string;
}

/** Entrée du journal : données, estampille de Lamport et hachages. */
export interface AuditEvent extends AuditEntryInput {
  /** Position dans la chaîne (à partir de 0). */
  index: number;
  /** Estampille de Lamport. */
  lamport: number;
  /** Hachage de l'entrée précédente (chaîne vide pour la première). */
  previousHash: string;
  /** SHA-256(previousHash + JSON canonique de l'entrée). */
  hash: string;
}

/** Résultat de la vérification de la chaîne. */
export type VerifyResult = { intact: true } | { intact: false; brokenAt: number };
