/** Pathologies suivies par la veille (puces de la maquette 08), dans l'ordre d'affichage. */
export const EPIDEMIOLOGY_PATHOLOGIES = ['choléra', 'paludisme', 'rougeole', 'dengue', 'mpox'] as const;

/** Identifiant d'une pathologie suivie. */
export type EpidemiologyPathology = (typeof EPIDEMIOLOGY_PATHOLOGIES)[number];

/** Nombre de cas d'une pathologie dans un district pour une semaine (`GET /analyse/cas`). */
export interface CaseRow {
  pathology: string;
  district: string;
  cases: number;
}

/** Réponse de `GET /analyse/cas`. */
export interface CasesResponse {
  /** Semaine ISO (`2026-W44`), absente tant qu'aucun cas n'est connu. */
  week: string | null;
  rows: CaseRow[];
}

/** Point de la courbe sur 12 semaines (`GET /analyse/serie`). */
export interface SeriesPoint {
  week: string;
  cases: number;
  expected: number;
  threshold: number;
  anomaly: boolean;
}

/** Foyer anormal (`GET /analyse/foyers`). */
export interface Outbreak {
  pathology: string;
  district: string;
  cases: number;
  expected: number;
  threshold: number;
}

/** District classé (`GET /analyse/districts`). */
export interface DistrictRank {
  district: string;
  cases: number;
  outbreak: boolean;
}

/** Nouveau cas pseudonymisé reçu par le flux temps réel. */
export interface LiveCase {
  pathology: string;
  district: string;
  week: string;
}

/** Niveau d'une bulle : foyer anormal, hausse à surveiller, niveau attendu. */
export type BubbleLevel = 'outbreak' | 'rise' | 'expected';

/** État du flux temps réel. */
export type LiveStatus = 'connecting' | 'live' | 'offline';

/** Réactions de la vue-modèle au flux temps réel. */
export interface LiveHandlers {
  onCase(item: LiveCase): void;
  onStatus(status: LiveStatus): void;
}
