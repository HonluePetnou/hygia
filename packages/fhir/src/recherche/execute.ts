import { ageAt } from './dates.js';
import { normalizeQuery } from './rule-based-interpreter.js';
import type { Comparator, PatientFile, SearchFilter, SearchResultRow } from './types.js';

const compare = (actual: number, comparator: Comparator, expected: number): boolean => {
  switch (comparator) {
    case 'gt':
      return actual > expected;
    case 'gte':
      return actual >= expected;
    case 'lt':
      return actual < expected;
    case 'lte':
      return actual <= expected;
    case 'eq':
      return actual === expected;
  }
};

/** Date (`YYYY-MM-DD`) de la dernière consultation du dossier. */
export function lastVisitOf(file: PatientFile): string | undefined {
  return file.encounters
    .map((encounter) => encounter.start.slice(0, 10))
    .sort()
    .at(-1);
}

/** Valeur la plus récente d'une mesure (par code LOINC). */
function latestValue(file: PatientFile, loinc: string): number | undefined {
  return [...file.observations]
    .filter((observation) => observation.code.code === loinc)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
    .at(-1)?.value;
}

/** Vrai si le dossier vérifie le filtre. */
export function matchesFilter(file: PatientFile, filter: SearchFilter, today: string): boolean {
  switch (filter.kind) {
    case 'diagnosis':
      return file.conditions.some((c) => c.code.code.startsWith(filter.code));
    case 'age':
      return compare(ageAt(file.patient.birthDate, today), filter.comparator, filter.value);
    case 'gender':
      return file.patient.gender === filter.value;
    case 'lab': {
      const value = latestValue(file, filter.loinc);
      return value !== undefined && compare(value, filter.comparator, filter.value);
    }
    case 'lastVisit': {
      const visit = lastVisitOf(file);
      if (visit === undefined) return false;
      return filter.comparator === 'gte' ? visit >= filter.date : visit <= filter.date;
    }
    case 'text': {
      const haystack = normalizeQuery(
        [
          file.patient.givenName,
          file.patient.familyName,
          file.patient.ipp,
          ...file.conditions.map((c) => `${c.code.code} ${c.code.display}`),
          ...file.documents.map((d) => d.title),
        ].join(' '),
      );
      return filter.value.split(' ').every((word) => haystack.includes(word));
    }
  }
}

/** Langue dominante des documents du dossier (français par défaut). */
function languageOf(file: PatientFile): 'fr' | 'en' {
  const english = file.documents.filter((d) => d.language === 'en').length;
  return english > file.documents.length - english ? 'en' : 'fr';
}

/** Ligne de résultat d'un dossier. */
export function toRow(file: PatientFile, today: string): SearchResultRow {
  const { patient } = file;
  const lastVisit = lastVisitOf(file);
  const organization = patient.managingOrganization.display;
  return {
    id: patient.id,
    ipp: patient.ipp,
    givenName: patient.givenName,
    familyName: patient.familyName,
    birthDate: patient.birthDate,
    age: ageAt(patient.birthDate, today),
    gender: patient.gender,
    diagnoses: file.conditions.map((c) => ({ code: c.code.code, label: c.code.display })),
    ...(lastVisit ? { lastVisit } : {}),
    ...(organization ? { organization } : {}),
    language: languageOf(file),
  };
}

/** Dossiers vérifiant tous les filtres (ET logique), sous forme de lignes triées par nom. */
export function runSearch(
  files: readonly PatientFile[],
  filters: readonly SearchFilter[],
  today: string,
): SearchResultRow[] {
  return files
    .filter((file) => filters.every((filter) => matchesFilter(file, filter, today)))
    .map((file) => toRow(file, today))
    .sort((a, b) => a.familyName.localeCompare(b.familyName) || a.givenName.localeCompare(b.givenName));
}
