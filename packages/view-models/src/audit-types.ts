import type { Role } from '@hygia/types';

/** Filtres du journal (même vocabulaire que le service Audit). */
export const AUDIT_FILTERS = ['tous', 'lectures', 'modifications', 'bris_de_glace', 'copilote', 'exports'] as const;
export type AuditFilter = (typeof AUDIT_FILTERS)[number];

/** Action journalisée. */
export type AuditActionName =
  | 'lecture'
  | 'modification'
  | 'creation'
  | 'bris_de_glace'
  | 'question_copilote'
  | 'alerte_ia'
  | 'import_document'
  | 'export';

/** Entrée du journal telle que renvoyée par le service Audit. */
export interface AuditEventData {
  index: number;
  lamport: number;
  timestamp: string;
  actor: string;
  role: Role;
  action: AuditActionName;
  resourceType: string;
  resourceId: string;
  patientId: string;
  reason: string;
  previousHash: string;
  hash: string;
}

export interface AuditSearch {
  filter: AuditFilter;
  text: string;
  page: number;
  pageSize: number;
}

export interface AuditPageData {
  items: AuditEventData[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditSummaryData {
  eventsToday: number;
  breakGlassToday: number;
  chainBreaks: number;
  chainIntact: boolean;
  brokenAt?: number;
  verifiedAt?: string;
  total: number;
  lastEntries: AuditEventData[];
}
