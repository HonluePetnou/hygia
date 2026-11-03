import type { CopiloteSource, Resume } from './types.js';

/** Ligne de résumé avec les numéros de ses sources. */
export interface SummaryLine {
  text: string;
  /** Numéros de source (communs à tout le résumé). */
  refs: number[];
}

/** Section du résumé pré-consultation. */
export interface SummarySection {
  id: 'antecedents' | 'traitements' | 'resultats' | 'alertes';
  title: string;
  lines: SummaryLine[];
}

/** Source numérotée de bout en bout du résumé. */
export interface NumberedSource {
  n: number;
  documentId: string;
  title: string;
  date: string;
}

const SECTION_IDS = ['antecedents', 'traitements', 'resultats', 'alertes'] as const;

/** Numérote les sources du résumé dans l'ordre d'apparition (un numéro par document). */
export function buildSummarySections(summary: Resume): {
  sections: SummarySection[];
  sources: NumberedSource[];
} {
  const sources: NumberedSource[] = [];
  const numberOf = (source: CopiloteSource): number => {
    const known = sources.find((s) => s.documentId === source.documentId);
    if (known) return known.n;
    const n = sources.length + 1;
    sources.push({ n, documentId: source.documentId, title: source.titre, date: source.date });
    return n;
  };
  const sections = SECTION_IDS.map((id): SummarySection => ({
    id,
    title: summary.titres[id],
    lines: summary[id].map((item) => ({
      text: item.texte,
      refs: [...new Set(item.sources.map(numberOf))],
    })),
  }));
  return { sections, sources };
}
