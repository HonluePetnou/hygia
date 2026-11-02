import type {
  DetectedIssue,
  DocumentReference,
  Encounter,
  MedicationRequest,
  Observation,
  Patient,
} from '@hygia/types';

/** Jeton d'injection de `PatientRepository`. */
export const PATIENT_REPOSITORY = Symbol('PATIENT_REPOSITORY');

/** Alerte IA datée, telle qu'affichée dans la chronologie. */
export interface DatedAlert {
  issue: DetectedIssue;
  raisedAt: string;
}

/** Contenu clinique d'un patient. */
export interface PatientRecord {
  encounters: Encounter[];
  observations: Observation[];
  medicationRequests: MedicationRequest[];
  documents: DocumentReference[];
  alerts: DatedAlert[];
}

/** Résultat d'une mise à jour avec contrôle de version optimiste. */
export type SaveResult =
  | { status: 'saved'; patient: Patient }
  | { status: 'not_found' }
  | { status: 'conflict'; currentVersion: number };

/** Accès aux données patients (implémentation en mémoire ; Prisma/PostgreSQL ensuite). */
export interface PatientRepository {
  /** Patients dont le nom ou l'IPP contient `query` (tous si vide). */
  search(query: string): Patient[];
  findById(id: string): Patient | undefined;
  /** Contenu clinique du patient. */
  recordOf(patientId: string): PatientRecord;
  /** Identifiants des patients suivis par les équipes de soins du praticien. */
  patientIdsOfCareTeams(practitionerId: string): ReadonlySet<string>;
  /** Remplace les champs modifiables si `expectedVersion` est la version courante. */
  update(
    id: string,
    changes: Partial<Pick<Patient, 'givenName' | 'familyName' | 'gender' | 'birthDate'>>,
    expectedVersion: number,
  ): SaveResult;
}
