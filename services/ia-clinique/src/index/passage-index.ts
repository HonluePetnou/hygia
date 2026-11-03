import type { IsoDateTime, Language, Uuid } from '@hygia/types';

/** Jeton d'injection de `PassageIndex`. */
export const PASSAGE_INDEX = Symbol('PASSAGE_INDEX');

/** Document fictif du dossier, avec son texte intégral (sortie de l'ingestion). */
export interface IndexedDocument {
  documentId: Uuid;
  patientId: Uuid;
  title: string;
  date: IsoDateTime;
  language: Language;
  /** Un paragraphe par ligne. */
  text: string;
}

/** Fragment de document retrouvé par la recherche. */
export interface Passage {
  id: string;
  patientId: Uuid;
  documentId: Uuid;
  title: string;
  date: IsoDateTime;
  text: string;
}

/** Passage et son score de pertinence. */
export interface ScoredPassage extends Passage {
  score: number;
}

/** Recherche de passages dans le dossier d'un patient (pgvector ensuite). */
export interface PassageIndex {
  /**
   * Passages les plus pertinents pour `query`, du meilleur au moins bon.
   * Ne renvoie jamais un passage d'un autre patient ni un passage de score nul.
   */
  search(patientId: Uuid, query: string, limit: number): ScoredPassage[];
}
