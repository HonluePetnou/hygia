import type { Uuid } from '@hygia/types';
import type { IndexedDocument, Passage, PassageIndex, ScoredPassage } from './passage-index.js';
import { tokenize } from './text.js';

interface Entry {
  passage: Passage;
  /** Fréquence de chaque mot (titre du document inclus, pour garder le contexte). */
  frequencies: Map<string, number>;
}

/** Découpe un texte en passages : un par ligne non vide. */
export function splitIntoPassages(document: IndexedDocument): Passage[] {
  return document.text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((text, position) => ({
      id: `${document.documentId}#${position + 1}`,
      patientId: document.patientId,
      documentId: document.documentId,
      title: document.title,
      date: document.date,
      text,
    }));
}

/**
 * Index en mémoire : recherche par mots-clés avec un score TF-IDF simple, calculé sur les seuls
 * passages du patient interrogé (jamais ceux des autres dossiers).
 */
export class InMemoryPassageIndex implements PassageIndex {
  private readonly byPatient = new Map<Uuid, Entry[]>();

  constructor(documents: readonly IndexedDocument[]) {
    for (const document of documents) {
      const entries = this.byPatient.get(document.patientId) ?? [];
      for (const passage of splitIntoPassages(document)) {
        entries.push({ passage, frequencies: countWords(`${passage.title} ${passage.text}`) });
      }
      this.byPatient.set(document.patientId, entries);
    }
  }

  search(patientId: Uuid, query: string, limit: number): ScoredPassage[] {
    const entries = this.byPatient.get(patientId) ?? [];
    const terms = [...new Set(tokenize(query))];
    if (entries.length === 0 || terms.length === 0) return [];
    const idf = (term: string): number => {
      const containing = entries.filter((entry) => entry.frequencies.has(term)).length;
      return containing === 0 ? 0 : Math.log(1 + entries.length / containing);
    };
    const weights = new Map(terms.map((term) => [term, idf(term)]));
    return entries
      .map((entry) => ({
        ...entry.passage,
        score: terms.reduce(
          (sum, term) => sum + (entry.frequencies.get(term) ?? 0) * (weights.get(term) ?? 0),
          0,
        ),
      }))
      .filter((scored) => scored.score > 0)
      .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
      .slice(0, limit);
  }
}

function countWords(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of tokenize(text)) counts.set(word, (counts.get(word) ?? 0) + 1);
  return counts;
}
