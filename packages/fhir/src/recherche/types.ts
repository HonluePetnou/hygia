import type { Condition, DocumentReference, Encounter, Observation, Patient } from '@hygia/types';

/** Comparateur d'un filtre numérique ou daté. */
export type Comparator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';

/** Mesure biologique reconnue (clé stable, code LOINC, unité usuelle). */
export interface LabTest {
  key: string;
  loinc: string;
  label: string;
  unit: string;
}

/** Filtre structuré issu d'une requête libre (ce que le soignant voit sous forme de puces). */
export type SearchFilter =
  | { kind: 'diagnosis'; code: string; label: string }
  | { kind: 'age'; comparator: Comparator; value: number }
  | { kind: 'lastVisit'; comparator: 'gte' | 'lte'; date: string }
  | {
      kind: 'lab';
      test: string;
      loinc: string;
      label: string;
      comparator: Comparator;
      value: number;
      unit: string;
    }
  | { kind: 'gender'; value: 'female' | 'male' }
  | { kind: 'text'; value: string };

/** Transforme une requête libre (français ou anglais) en filtres structurés. */
export interface QueryInterpreter {
  /** Filtres compris dans `query` ; liste vide si rien n'est reconnu. */
  interpret(query: string): SearchFilter[];
}

/** Dossier patient complet tel que lu par la recherche. */
export interface PatientFile {
  patient: Patient;
  conditions: readonly Condition[];
  observations: readonly Observation[];
  encounters: readonly Encounter[];
  documents: readonly DocumentReference[];
}

/** Ligne du tableau de résultats (maquette « 03 · Patients »). */
export interface SearchResultRow {
  id: string;
  ipp: string;
  givenName: string;
  familyName: string;
  birthDate: string;
  age: number;
  gender: Patient['gender'];
  diagnoses: Array<{ code: string; label: string }>;
  /** Date (`YYYY-MM-DD`) de la dernière consultation, si elle existe. */
  lastVisit?: string;
  organization?: string;
  language: 'fr' | 'en';
}

/** Réponse de `POST /recherche`. */
export interface SearchResponse {
  filtres: SearchFilter[];
  resultats: SearchResultRow[];
  /** Nombre total de résultats avant pagination. */
  total: number;
  page: number;
  taille: number;
}
