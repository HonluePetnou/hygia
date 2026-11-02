import type { BaseResource, Coding, IsoDateTime, Language, Reference } from './common.js';

/** Statut de traitement d'un document par la chaîne d'ingestion. */
export type ProcessingStatus = 'received' | 'processing' | 'processed' | 'failed';

/** Document clinique versionné. */
export interface DocumentReference extends BaseResource {
  resourceType: 'DocumentReference';
  subject: Reference;
  /** Type de document (ex. compte rendu d'échographie). */
  documentType: string;
  /** Titre affiché. */
  title: string;
  /** Langue du contenu. */
  language: Language;
  /** Date du document. */
  date: IsoDateTime;
  /** Statut de traitement. */
  processingStatus: ProcessingStatus;
}

/** Mesure (biologie, constante, imagerie). */
export interface Observation extends BaseResource {
  resourceType: 'Observation';
  subject: Reference;
  /** Code de la mesure (ex. LOINC). */
  code: Coding;
  /** Valeur numérique. */
  value: number;
  /** Unité de la valeur. */
  unit: string;
  /** Date de la mesure. */
  effectiveDate: IsoDateTime;
}

/** Pathologie ou diagnostic. */
export interface Condition extends BaseResource {
  resourceType: 'Condition';
  subject: Reference;
  /** Code CIM-10. */
  code: Coding;
  /** Date de début. */
  onsetDate: IsoDateTime;
}

/** Prescription médicamenteuse. */
export interface MedicationRequest extends BaseResource {
  resourceType: 'MedicationRequest';
  subject: Reference;
  /** Prescripteur. */
  requester: Reference;
  /** Médicament, code ATC. */
  medication: Coding;
  /** Posologie. */
  dosage: Dosage;
  /** Date de prescription. */
  authoredOn: IsoDateTime;
}

/** Posologie d'une prescription. */
export interface Dosage {
  /** Dose par prise. */
  doseValue: number;
  /** Unité de dose (ex. mg). */
  doseUnit: string;
  /** Nombre de prises par jour. */
  timesPerDay: number;
}

/** Allergie ou intolérance. */
export interface AllergyIntolerance extends BaseResource {
  resourceType: 'AllergyIntolerance';
  subject: Reference;
  /** Substance en cause. */
  substance: Coding;
  /** Criticité. */
  criticality: 'low' | 'high';
}
