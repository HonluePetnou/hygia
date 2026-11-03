import {
  extractAge,
  extractDiagnoses,
  extractGender,
  extractLabs,
  extractRelativeVisit,
  extractVisitDate,
  type Extraction,
} from './extractors.js';
import { STOP_WORDS } from './lexicon.js';
import type { QueryInterpreter, SearchFilter } from './types.js';

/** Minuscules, sans accents ni apostrophes : forme sur laquelle travaillent les règles. */
export function normalizeQuery(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’']/g, ' ')
    .toLowerCase();
}

/**
 * Interpréteur à règles (pathologies → CIM-10, âges, dates relatives et absolues, valeurs
 * biologiques avec comparateurs, sexe). Les mots non reconnus deviennent une recherche par mot-clé.
 * Remplaçable par un interpréteur appuyé sur le modèle de langage : même interface.
 */
export class RuleBasedQueryInterpreter implements QueryInterpreter {
  /** @param today Date du jour (`YYYY-MM-DD`) pour les dates relatives (« depuis janvier »). */
  constructor(private readonly today: () => string) {}

  interpret(query: string): SearchFilter[] {
    const today = this.today();
    const steps: Array<(text: string) => Extraction> = [
      extractLabs,
      (text) => extractRelativeVisit(text, today),
      (text) => extractVisitDate(text, today),
      extractAge,
      extractGender,
      extractDiagnoses,
    ];
    const filters: SearchFilter[] = [];
    let rest = normalizeQuery(query);
    for (const step of steps) {
      const found = step(rest);
      filters.push(...found.filters);
      rest = found.rest;
    }
    const keywords = rest
      .split(/\s+/)
      .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
      .filter((word) => word.length > 0 && !STOP_WORDS.has(word));
    if (keywords.length > 0) filters.push({ kind: 'text', value: keywords.join(' ') });
    return filters;
  }
}
