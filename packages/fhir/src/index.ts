export { validateResource, REQUIRED_FIELDS } from './validate.js';
export type { ValidationResult } from './validate.js';
export { demoDataset } from './demo-dataset.js';
export { FLORENCE_ID, NANA_ID } from './demo-admin.js';
export { FLORENCE_DOUBLON_ID } from './demo-doublon.js';
export { RuleBasedQueryInterpreter, normalizeQuery } from './recherche/rule-based-interpreter.js';
export { runSearch, matchesFilter, toRow, lastVisitOf } from './recherche/execute.js';
export { ageAt } from './recherche/dates.js';
export type {
  Comparator,
  PatientFile,
  QueryInterpreter,
  SearchFilter,
  SearchResponse,
  SearchResultRow,
} from './recherche/types.js';
