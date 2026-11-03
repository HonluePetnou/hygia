import type { AuditPageData, AuditSearch, AuditSummaryData } from './audit-types.js';

/** Accès en lecture seule au journal d'audit (service Audit, via le broker). */
export interface AuditGateway {
  /** Recherche filtrée et paginée, du plus récent au plus ancien. */
  search(search: AuditSearch): Promise<AuditPageData>;
  /** Indicateurs du jour et dernières entrées chaînées. */
  summary(): Promise<AuditSummaryData>;
  /** Export CSV des entrées correspondant à la recherche (toutes pages). */
  exportCsv(search: Omit<AuditSearch, 'page' | 'pageSize'>): Promise<string>;
}
