import type { Locale } from '@hygia/i18n';
import type {
  CasesResponse,
  DistrictRank,
  LiveHandlers,
  Outbreak,
  SeriesPoint,
} from './epidemiology-types.js';

/** Foyer signalé à la délégation régionale. */
export interface DelegationNotice {
  pathology: string;
  district: string;
  week: string;
  cases: number;
  threshold: number;
}

/** Accès à la branche analytique : agrégats pseudonymisés uniquement (service Agents, via le broker). */
export interface EpidemiologyGateway {
  /** Cas par district pour une pathologie ; sans `week`, la dernière semaine connue. */
  cases(pathology: string, week?: string): Promise<CasesResponse>;
  /** Courbe des 12 dernières semaines d'un district, avec seuil. */
  series(pathology: string, district: string, week?: string): Promise<SeriesPoint[]>;
  /** Districts les plus touchés pour la pathologie. */
  districts(pathology: string, week?: string, limit?: number): Promise<DistrictRank[]>;
  /** Foyers anormaux de la semaine (toutes pathologies). */
  outbreaks(week?: string): Promise<Outbreak[]>;
  /** Ouvre le flux temps réel (SSE) ; renvoie la fonction qui le ferme. */
  subscribe(handlers: LiveHandlers): () => void;
  /** Rapport PDF de la semaine (agrégats pseudonymisés), dans la langue demandée (audité). */
  exportReport(locale: Locale, pathology?: string): Promise<Blob>;
  /** Publie l'événement de notification de la délégation. */
  notifyDelegation(notice: DelegationNotice): Promise<void>;
}
