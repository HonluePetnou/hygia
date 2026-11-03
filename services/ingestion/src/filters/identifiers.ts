import type { Filter } from '../filter.js';
import type { DetectedIdentifier, ExtractedDocument, IdentifiedDocument } from '../types.js';

const WORD = String.raw`\p{Lu}[\p{L}'’-]+`;
const NAME_AFTER_TITLE = new RegExp(
  String.raw`\b(?:Dr|Dre|Pr|Mme|Mr|M\.)\s+(${WORD}(?:\s+${WORD})*)`,
  'gu',
);
const NAME_AFTER_PATIENT = new RegExp(
  String.raw`\bPatient(?:e)?\s*:\s*(${WORD}(?:\s+${WORD})*)`,
  'gu',
);
const PHONE = /(?<!\d)(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}(?!\d)/g;
const DATE = /\b\d{2}\/\d{2}\/\d{4}\b/g;

function collect(text: string, pattern: RegExp, kind: DetectedIdentifier['kind'], group = 0) {
  return [...text.matchAll(pattern)].flatMap((m) => {
    const value = m[group];
    return value === undefined ? [] : [{ kind, value }];
  });
}

/** Filtre 5 — Détection des identifiants : noms (praticiens, patients), téléphones, dates. */
export class IdentifierDetectionFilter implements Filter<ExtractedDocument, IdentifiedDocument> {
  readonly name = 'identifiants';

  async process(input: ExtractedDocument): Promise<IdentifiedDocument> {
    const { text } = input;
    const subjectName = input.subject?.display;
    const found: DetectedIdentifier[] = [
      ...collect(text, NAME_AFTER_TITLE, 'name', 1),
      ...collect(text, NAME_AFTER_PATIENT, 'name', 1),
      ...(subjectName !== undefined && text.includes(subjectName)
        ? [{ kind: 'name' as const, value: subjectName }]
        : []),
      ...collect(text, PHONE, 'phone'),
      ...collect(text, DATE, 'date'),
    ];
    const unique = new Map(found.map((id) => [`${id.kind}:${id.value}`, id]));
    return { ...input, identifiers: [...unique.values()] };
  }
}
