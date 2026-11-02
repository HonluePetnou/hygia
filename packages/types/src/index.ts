import type { CareTeam, Encounter, Organization, Patient, Practitioner } from './administratif.js';
import type {
  AllergyIntolerance,
  Condition,
  DocumentReference,
  MedicationRequest,
  Observation,
} from './clinique.js';
import type { AuditEvent, DetectedIssue } from './ia-audit.js';

export * from './common.js';
export * from './administratif.js';
export * from './clinique.js';
export * from './ia-audit.js';

/** Union de toutes les ressources HYGIA. */
export type Resource =
  | Patient
  | Practitioner
  | Organization
  | CareTeam
  | Encounter
  | DocumentReference
  | Observation
  | Condition
  | MedicationRequest
  | AllergyIntolerance
  | DetectedIssue
  | AuditEvent;
