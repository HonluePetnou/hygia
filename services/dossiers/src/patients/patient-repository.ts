import type {
  AllergyIntolerance,
  Condition,
  DetectedIssue,
  DocumentReference,
  Encounter,
  MedicationRequest,
  Observation,
  Patient,
  Practitioner,
} from '@hygia/types';
import type { ConsultationInput, ConsultationResources } from '../consultations/consultation.js';

/** Jeton d'injection de `PatientRepository`. */
export const PATIENT_REPOSITORY = Symbol('PATIENT_REPOSITORY');

/** Alerte IA datée, telle qu'affichée dans la chronologie. */
export interface DatedAlert {
  issue: DetectedIssue;
  raisedAt: string;
}

/** Contenu clinique d'un patient. */
export interface PatientRecord {
  conditions: Condition[];
  encounters: Encounter[];
  observations: Observation[];
  medicationRequests: MedicationRequest[];
  documents: DocumentReference[];
  alerts: DatedAlert[];
}

/** Résultat d'une mise à jour avec contrôle de version optimiste. */
export type SaveResult<T = Patient> =
  | { status: 'saved'; resource: T }
  | { status: 'not_found' }
  | { status: 'conflict'; currentVersion: number };

/** Champs modifiables d'un document. */
export type DocumentChanges = Partial<
  Pick<DocumentReference, 'title' | 'documentType' | 'language' | 'processingStatus'>
>;

/** Champs de la fiche que la fusion permet de choisir. */
export type MergeableFields = Pick<
  Patient,
  'givenName' | 'familyName' | 'gender' | 'birthDate' | 'phone'
>;

/** Ressources cliniques rattachées à un patient, par type. */
export interface MovedResources {
  encounters: string[];
  observations: string[];
  medicationRequests: string[];
  documents: string[];
}

/** Trace d'une fusion : de quoi l'annuler sans perte. */
export interface MergeRecord {
  keptBefore: Patient;
  mergedBefore: Patient;
  keptAfter: Patient;
  mergedAfter: Patient;
  moved: MovedResources;
}

/** Accès aux données patients (implémentation en mémoire ; Prisma/PostgreSQL ensuite). */
export interface PatientRepository {
  /** Patients dont le nom ou l'IPP contient `query` (tous si vide) ; les dossiers fusionnés sont exclus. */
  search(query: string): Patient[];
  findById(id: string): Patient | undefined;
  /** Document par identifiant (état courant). */
  findDocument(id: string): DocumentReference | undefined;
  /** Contenu clinique du patient. */
  recordOf(patientId: string): PatientRecord;
  /** Allergies et intolérances du patient. */
  allergiesOf(patientId: string): AllergyIntolerance[];
  /** Nom de l'établissement de rattachement, s'il est connu. */
  organizationName(organizationId: string): string | undefined;
  /** Identifiants des patients suivis par les équipes de soins du praticien. */
  patientIdsOfCareTeams(practitionerId: string): ReadonlySet<string>;
  /** Praticiens des équipes de soins de l'établissement du patient. */
  careTeamOf(patientId: string): Practitioner[];
  /** Remplace les champs modifiables si `expectedVersion` est la version courante. */
  update(
    id: string,
    changes: Partial<Pick<Patient, 'givenName' | 'familyName' | 'gender' | 'birthDate'>>,
    expectedVersion: number,
  ): SaveResult;
  /** Remplace les champs modifiables d'un document si `expectedVersion` est sa version courante. */
  updateDocument(
    id: string,
    changes: DocumentChanges,
    expectedVersion: number,
  ): SaveResult<DocumentReference>;
  /** Ajoute une consultation (rencontre, mesures, diagnostics, prescriptions) ; ressources en version 1. */
  addConsultation(
    patientId: string,
    practitionerId: string,
    input: ConsultationInput,
    at: Date,
  ): ConsultationResources;
  /** Tous les patients actifs (non fusionnés). */
  activePatients(): Patient[];
  /**
   * Fusionne `mergedId` dans `keptId` : ressources déplacées, champs choisis appliqués, l'autre
   * dossier marqué « fusionné dans » (versions incrémentées). Le contrôle d'accès est fait avant.
   */
  merge(keptId: string, mergedId: string, fields: MergeableFields): MergeRecord;
  /** Annule une fusion : ressources, fiches et marque « fusionné dans » reviennent à l'état d'avant. */
  unmerge(record: MergeRecord): void;
}
