import { endOfMonth, makeDate, subtract } from './dates.js';
import {
  COMPARATOR_SYMBOLS,
  COMPARATOR_WORDS,
  DIAGNOSES,
  LAB_TESTS,
  MONTHS,
} from './lexicon.js';
import type { Comparator, SearchFilter } from './types.js';

/** Résultat d'un extracteur : filtres trouvés et texte restant (passages reconnus remplacés par un espace). */
export interface Extraction {
  filters: SearchFilter[];
  rest: string;
}

const escape = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SYMBOLS = '>=|<=|==|≥|≤|>|<|=';
const WORDS = COMPARATOR_WORDS.map(([word]) => escape(word).replace(/ /g, '\\s+')).join('|');
const COMPARATOR = `(${SYMBOLS}|(?<![a-z])(?:${WORDS}))`;
const NUMBER = '(\\d+(?:[.,]\\d+)?)';

const comparatorOf = (raw: string): Comparator => {
  const squeezed = raw.replace(/\s+/g, ' ');
  return (
    COMPARATOR_SYMBOLS[squeezed] ??
    COMPARATOR_WORDS.find(([word]) => word === squeezed)?.[1] ??
    'eq'
  );
};

/** Retire les passages reconnus par `pattern` et renvoie ce qui reste. */
function consume(
  text: string,
  pattern: RegExp,
  build: (match: RegExpMatchArray) => SearchFilter | undefined,
): Extraction {
  const filters: SearchFilter[] = [];
  let rest = '';
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const filter = build(match);
    if (!filter) continue;
    filters.push(filter);
    rest += `${text.slice(last, match.index)} `;
    last = (match.index ?? 0) + match[0].length;
  }
  return { filters, rest: rest + text.slice(last) };
}

/** Valeurs biologiques avec comparateur : « HbA1c > 8 % », « INR at least 3 ». */
export function extractLabs(text: string): Extraction {
  const filters: SearchFilter[] = [];
  let rest = text;
  for (const lab of LAB_TESTS) {
    const names = lab.words.map(escape).join('|');
    const pattern = new RegExp(`\\b(?:${names})\\s*${COMPARATOR}\\s*${NUMBER}\\s*(?:%|ratio)?`, 'g');
    const found = consume(rest, pattern, (m) => ({
      kind: 'lab',
      test: lab.key,
      loinc: lab.loinc,
      label: lab.label,
      comparator: comparatorOf(m[1] ?? ''),
      value: Number((m[2] ?? '0').replace(',', '.')),
      unit: lab.unit,
    }));
    filters.push(...found.filters);
    rest = found.rest;
  }
  return { filters, rest };
}

/** Sexe : « femmes », « men »… */
export function extractGender(text: string): Extraction {
  const female = consume(text, /\b(femmes?|patientes?|women|woman|female|females)\b/g, () => ({
    kind: 'gender',
    value: 'female',
  }));
  const male = consume(female.rest, /\b(hommes?|men|man|male|males)\b/g, () => ({
    kind: 'gender',
    value: 'male',
  }));
  return { filters: [...female.filters.slice(0, 1), ...male.filters.slice(0, 1)], rest: male.rest };
}

/** Âges : « de plus de 60 ans », « under 40 », « 65 ans ou plus ». */
export function extractAge(text: string): Extraction {
  const unit = '(?:ans?|years?)(?:\\s+old)?';
  const withComparator = consume(
    text,
    new RegExp(`${COMPARATOR}\\s*${NUMBER}\\s*(${unit})?`, 'g'),
    (m) => {
      const comparator = comparatorOf(m[1] ?? '');
      const agePhrase = /older|younger/.test(m[1] ?? '');
      if (!m[3] && !agePhrase) return undefined;
      return { kind: 'age', comparator, value: Number(m[2]) };
    },
  );
  const orMore = consume(
    withComparator.rest,
    new RegExp(`${NUMBER}\\s*${unit}\\s*(ou plus|et plus|or older|and over|ou moins|or younger)`, 'g'),
    (m) => ({
      kind: 'age',
      comparator: /moins|younger/.test(m[2] ?? '') ? 'lte' : 'gte',
      value: Number(m[1]),
    }),
  );
  return { filters: [...withComparator.filters, ...orMore.filters], rest: orMore.rest };
}

const UNITS: Readonly<Record<string, 'day' | 'month' | 'year'>> = {
  jour: 'day', jours: 'day', day: 'day', days: 'day',
  mois: 'month', month: 'month', months: 'month',
  an: 'year', ans: 'year', annee: 'year', annees: 'year', year: 'year', years: 'year',
};

const AFTER = "(?:depuis(?:\\s+le)?|a\\s+partir\\s+d(?:e|u)|apres(?:\\s+le)?|since|from|after)";
const BEFORE = "(?:avant(?:\\s+le)?|jusqu\\s*a\\s*u?|before|until|up\\s+to)";

/** Dernière visite : « depuis 6 mois », « in the last 2 years ». */
export function extractRelativeVisit(text: string, today: string): Extraction {
  const pattern = new RegExp(
    `\\b(?:depuis|since|in\\s+the\\s+last|within\\s+the\\s+last|over\\s+the\\s+last|dans\\s+les|derniers?|last)\\s+${NUMBER}\\s*(jours?|days?|mois|months?|ans?|annees?|years?)\\b`,
    'g',
  );
  return consume(text, pattern, (m) => {
    const unit = UNITS[m[2] ?? ''];
    if (!unit) return undefined;
    return { kind: 'lastVisit', comparator: 'gte', date: subtract(today, Number(m[1]), unit) };
  });
}

const DATE = '(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/\\d{4}|(?:\\d{1,2}(?:er)?\\s+)?[a-z]+(?:\\s+\\d{4})?)';

/** Résout une date écrite (ISO, jj/mm/aaaa ou « 15 mars 2026 », « janvier »). */
function resolveDate(raw: string, today: string, edge: 'start' | 'end'): string | undefined {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return makeDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (slash) return makeDate(Number(slash[3]), Number(slash[2]), Number(slash[1]));
  const named = /^(?:(\d{1,2})(?:er)?\s+)?([a-z]+)(?:\s+(\d{4}))?$/.exec(raw);
  const month = named ? MONTHS[named[2] ?? ''] : undefined;
  if (!named || !month) return undefined;
  const [ty = 0, tm = 1, td = 1] = today.split('-').map(Number);
  let year = named[3] ? Number(named[3]) : ty;
  if (!named[3] && (month > tm || (month === tm && named[1] && Number(named[1]) > td))) year -= 1;
  if (named[1]) return makeDate(year, month, Number(named[1]));
  return edge === 'start' ? makeDate(year, month, 1) : endOfMonth(year, month);
}

/** Dates absolues ou mois : « depuis janvier », « avant le 15/03/2026 », « since March 2026 ». */
export function extractVisitDate(text: string, today: string): Extraction {
  const build = (comparator: 'gte' | 'lte') => (m: RegExpMatchArray): SearchFilter | undefined => {
    const date = resolveDate((m[1] ?? '').trim(), today, comparator === 'gte' ? 'start' : 'end');
    return date ? { kind: 'lastVisit', comparator, date } : undefined;
  };
  const after = consume(text, new RegExp(`\\b${AFTER}\\s+${DATE}`, 'g'), build('gte'));
  const before = consume(after.rest, new RegExp(`\\b${BEFORE}\\s+${DATE}`, 'g'), build('lte'));
  return { filters: [...after.filters, ...before.filters], rest: before.rest };
}

/** Pathologies connues → code CIM-10. */
export function extractDiagnoses(text: string): Extraction {
  const filters: SearchFilter[] = [];
  let rest = text;
  for (const entry of DIAGNOSES) {
    const words = [...entry.words].sort((a, b) => b.length - a.length).map(escape);
    const found = consume(rest, new RegExp(`\\b(?:${words.join('|')})\\b`, 'g'), () => ({
      kind: 'diagnosis',
      code: entry.code,
      label: entry.label,
    }));
    if (found.filters.length > 0) filters.push(found.filters[0] as SearchFilter);
    rest = found.rest;
  }
  return { filters, rest };
}
