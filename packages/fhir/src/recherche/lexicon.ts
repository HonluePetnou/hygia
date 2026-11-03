import type { Comparator, LabTest } from './types.js';

/** Pathologie reconnue : mots-clés (sans accents, minuscules) → code CIM-10. */
export interface DiagnosisEntry {
  code: string;
  label: string;
  words: readonly string[];
}

export const DIAGNOSES: readonly DiagnosisEntry[] = [
  {
    code: 'E11',
    label: 'Diabète de type 2',
    words: ['diabete', 'diabetique', 'diabetiques', 'diabetes', 'diabetic'],
  },
  {
    code: 'I10',
    label: 'Hypertension artérielle',
    words: ['hypertension', 'hypertendu', 'hypertendus', 'hypertensive', 'hypertensif'],
  },
  { code: 'I50', label: 'Insuffisance cardiaque', words: ['insuffisance cardiaque', 'heart failure'] },
  {
    code: 'I48',
    label: 'Fibrillation auriculaire',
    words: ['fibrillation auriculaire', 'atrial fibrillation', 'fibrillation'],
  },
  {
    code: 'J45',
    label: 'Asthme',
    words: ['asthme', 'asthmatique', 'asthmatiques', 'asthma', 'asthmatic'],
  },
  {
    code: 'N18',
    label: 'Maladie rénale chronique',
    words: ['insuffisance renale', 'maladie renale', 'kidney disease', 'renal failure'],
  },
];

/** Mesures biologiques reconnues, avec leurs libellés (sans accents, minuscules). */
export const LAB_TESTS: ReadonlyArray<LabTest & { words: readonly string[] }> = [
  {
    key: 'hba1c',
    loinc: '4548-4',
    label: 'HbA1c',
    unit: '%',
    words: ['hba1c', 'hemoglobine glyquee', 'glycated hemoglobin'],
  },
  { key: 'inr', loinc: '34714-6', label: 'INR', unit: 'ratio', words: ['inr'] },
  { key: 'fevg', loinc: '10230-1', label: 'FEVG', unit: '%', words: ['fevg', 'lvef'] },
];

/** Comparateurs en toutes lettres, du plus long au plus court. */
export const COMPARATOR_WORDS: ReadonlyArray<readonly [string, Comparator]> = [
  ['superieure ou egale a', 'gte'],
  ['superieur ou egal a', 'gte'],
  ['greater than or equal to', 'gte'],
  ['at least', 'gte'],
  ['inferieure ou egale a', 'lte'],
  ['inferieur ou egal a', 'lte'],
  ['less than or equal to', 'lte'],
  ['at most', 'lte'],
  ['superieure a', 'gt'],
  ['superieur a', 'gt'],
  ['greater than', 'gt'],
  ['more than', 'gt'],
  ['older than', 'gt'],
  ['plus de', 'gt'],
  ['above', 'gt'],
  ['over', 'gt'],
  ['inferieure a', 'lt'],
  ['inferieur a', 'lt'],
  ['less than', 'lt'],
  ['younger than', 'lt'],
  ['moins de', 'lt'],
  ['below', 'lt'],
  ['under', 'lt'],
];

/** Comparateurs symboliques. */
export const COMPARATOR_SYMBOLS: Readonly<Record<string, Comparator>> = {
  '>': 'gt',
  '>=': 'gte',
  '≥': 'gte',
  '<': 'lt',
  '<=': 'lte',
  '≤': 'lte',
  '=': 'eq',
  '==': 'eq',
};

/** Noms de mois (français et anglais, sans accents). */
export const MONTHS: Readonly<Record<string, number>> = {
  janvier: 1,
  january: 1,
  fevrier: 2,
  february: 2,
  mars: 3,
  march: 3,
  avril: 4,
  april: 4,
  mai: 5,
  may: 5,
  juin: 6,
  june: 6,
  juillet: 7,
  july: 7,
  aout: 8,
  august: 8,
  septembre: 9,
  september: 9,
  octobre: 10,
  october: 10,
  novembre: 11,
  november: 11,
  decembre: 12,
  december: 12,
};

/** Mots vides (français et anglais) ignorés avant la recherche par mot-clé. */
export const STOP_WORDS: ReadonlySet<string> = new Set([
  'patient', 'patients', 'patiente', 'patientes', 'vu', 'vus', 'vue', 'vues', 'seen', 'with', 'avec',
  'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'ou', 'and', 'or', 'the', 'a', 'an', 'of',
  'ayant', 'having', 'who', 'that', 'dont', 'qui', 'ans', 'years', 'year', 'old', 'age', 'aged',
  'depuis', 'since', 'avant', 'before', 'apres', 'after', 'dossier', 'dossiers', 'record', 'records',
  'trouver', 'find', 'show', 'montre', 'montrer', 'liste', 'list', 'en', 'in', 'on', 'au', 'aux',
  'last', 'derniers', 'dernieres', 'dernier', 'visit', 'visite', 'visites', 'consultation', 'chez',
  'for', 'pour', 'jusqu', 'until', 'from', 'est', 'sont', 'is', 'are', 'ont', 'have', 'has',
]);
