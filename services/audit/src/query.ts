import type { AuditAction, AuditEvent } from './types.js';

/** Filtres de l'écran (maquette 09). */
export const AUDIT_CATEGORIES = [
  'tous',
  'lectures',
  'modifications',
  'bris_de_glace',
  'copilote',
  'exports',
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

const ACTIONS_OF: Record<AuditCategory, readonly AuditAction[] | undefined> = {
  tous: undefined,
  lectures: ['lecture'],
  modifications: ['modification', 'creation', 'import_document'],
  bris_de_glace: ['bris_de_glace'],
  copilote: ['question_copilote', 'alerte_ia'],
  exports: ['export'],
};

/** Critères de recherche dans le journal. */
export interface AuditQuery {
  category?: AuditCategory;
  /** Limite à un patient (imposée pour le rôle patient). */
  patientId?: string;
  actor?: string;
  /** Recherche libre (acteur, ressource, patient, motif), sans casse. */
  text?: string;
  /** Bornes de date incluses, ISO 8601. */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/** Une page de résultats, du plus récent au plus ancien. */
export interface AuditPage {
  items: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;

function matchesText(e: AuditEvent, needle: string): boolean {
  return [e.actor, e.resourceType, e.resourceId, e.patientId, e.reason].some((field) =>
    field.toLowerCase().includes(needle),
  );
}

/** Événements correspondant aux critères, du plus récent au plus ancien (sans pagination). */
export function filterEvents(events: readonly AuditEvent[], query: AuditQuery): AuditEvent[] {
  const actions = ACTIONS_OF[query.category ?? 'tous'];
  const needle = query.text?.toLowerCase();
  return events
    .filter(
      (e) =>
        (actions === undefined || actions.includes(e.action)) &&
        (query.patientId === undefined || e.patientId === query.patientId) &&
        (query.actor === undefined || e.actor === query.actor) &&
        (needle === undefined || matchesText(e, needle)) &&
        (query.from === undefined || e.timestamp >= query.from) &&
        (query.to === undefined || e.timestamp <= query.to),
    )
    .sort((a, b) => b.index - a.index);
}

/** Recherche filtrée et paginée (pages numérotées à partir de 1). */
export function searchEvents(events: readonly AuditEvent[], query: AuditQuery): AuditPage {
  const pageSize = Math.min(Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const page = Math.max(1, query.page ?? 1);
  const matching = filterEvents(events, query);
  const start = (page - 1) * pageSize;
  return { items: matching.slice(start, start + pageSize), total: matching.length, page, pageSize };
}

/** Indicateurs du jour affichés en tête de l'écran. */
export interface AuditSummary {
  eventsToday: number;
  breakGlassToday: number;
  /** 0 ou 1 : la chaîne s'arrête à la première rupture. */
  chainBreaks: number;
  chainIntact: boolean;
  /** Position de la première entrée rompue, le cas échéant. */
  brokenAt?: number;
  /** Date de la dernière vérification (ISO 8601), si elle a eu lieu. */
  verifiedAt?: string;
  total: number;
  /** Les 3 dernières entrées (schéma de chaînage). */
  lastEntries: AuditEvent[];
}
