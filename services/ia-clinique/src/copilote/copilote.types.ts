import type { Language } from '@hygia/types';
import type { Passage } from '../index/passage-index.js';

/** Source citée à l'appui d'une réponse ou d'une ligne de résumé. */
export interface CopiloteSource {
  /** Numéro du marqueur `[n]` dans la réponse. */
  n: number;
  documentId: string;
  titre: string;
  date: string;
  extrait: string;
}

/** Réponse du copilote : toujours accompagnée de ses sources, ou explicitement sans source. */
export interface CopiloteAnswer {
  answer: string;
  language: Language;
  sources: CopiloteSource[];
  /** `true` en « mode dégradé : recherche simple » (modèle de langage indisponible). */
  degraded?: boolean;
}

const EXCERPT_LENGTH = 200;

/** Construit la source numérotée `n` à partir d'un passage retrouvé. */
export function toSource(n: number, passage: Passage): CopiloteSource {
  const text = passage.text;
  return {
    n,
    documentId: passage.documentId,
    titre: passage.title,
    date: passage.date,
    extrait: text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH - 1)}…` : text,
  };
}
