import type { Filter } from '../filter.js';
import type { ExtractedDocument, ExtractedEntity, NormalizedDocument } from '../types.js';

interface DictionaryEntry {
  /** Motif appliqué au texte sans accents ni casse. */
  pattern: RegExp;
  code: string;
}

/** Médicaments → ATC. */
export const MEDICATIONS: readonly DictionaryEntry[] = [
  { pattern: /\bibuprofene\b/g, code: 'M01AE01' },
  { pattern: /\bparacetamol\b/g, code: 'N02BE01' },
  { pattern: /\bramipril\b/g, code: 'C09AA05' },
  { pattern: /\bfurosemide\b/g, code: 'C03CA01' },
  { pattern: /\bmetformine\b/g, code: 'A10BA02' },
  { pattern: /\baspirine\b/g, code: 'B01AC06' },
];

/** Diagnostics → CIM-10 (les formes plurielles et dérivées sont acceptées). */
export const DIAGNOSES: readonly DictionaryEntry[] = [
  { pattern: /\blombalg\w*/g, code: 'M54.5' },
  { pattern: /\bhypertension\b/g, code: 'I10' },
  { pattern: /\binsuffisance cardiaque\b/g, code: 'I50.9' },
  { pattern: /\bdiabete de type 2\b/g, code: 'E11.9' },
];

const POSOLOGY = /\b\d+\s*mg\s*:\s*\d+\s*cp\s*[×x]\s*\d+\s*\/\s*j(?:\s*pdt\s*\d+\s*jours?)?/g;
const DATE = /\b\d{2}\/\d{2}\/\d{4}\b/g;

/** Retire les accents et met en minuscules (conserve la longueur du texte NFC). */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function find(
  text: string,
  entries: readonly DictionaryEntry[],
  kind: 'medication' | 'diagnosis',
): ExtractedEntity[] {
  return entries.flatMap(({ pattern, code }) =>
    [...text.matchAll(pattern)].map((match) => ({
      kind,
      text: match[0],
      code,
      // Terme exact du dictionnaire : confiance haute ; forme dérivée (pluriel) : un peu moindre.
      confidence: /s$/.test(match[0]) && kind === 'diagnosis' ? 0.85 : 0.95,
    })),
  );
}

function findPlain(text: string, pattern: RegExp, kind: 'posology' | 'date'): ExtractedEntity[] {
  return [...text.matchAll(pattern)].map((match) => ({
    kind,
    text: match[0],
    confidence: kind === 'date' ? 0.9 : 0.8,
  }));
}

/** Filtre 4 — Extraction : médicaments (ATC), diagnostics (CIM-10), posologies, dates. */
export class ExtractionFilter implements Filter<NormalizedDocument, ExtractedDocument> {
  readonly name = 'extraction';

  async process(input: NormalizedDocument): Promise<ExtractedDocument> {
    const text = fold(input.text);
    const entities = [
      ...find(text, MEDICATIONS, 'medication'),
      ...find(text, DIAGNOSES, 'diagnosis'),
      ...findPlain(text, POSOLOGY, 'posology'),
      ...findPlain(text, DATE, 'date'),
    ];
    return { ...input, entities };
  }
}
