import type { Coding, Condition, Encounter, MedicationRequest, Observation } from '@hygia/types';

/** Mesure d'une consultation (signe vital…). */
export interface ConsultationObservation {
  code: Coding;
  value: number;
  unit: string;
}

/** Prescription d'une consultation. */
export interface ConsultationPrescription {
  medication: Coding;
  doseValue: number;
  doseUnit: string;
  timesPerDay: number;
}

/** Contenu clinique d'une consultation, validé par le médecin avant l'envoi. */
export interface ConsultationInput {
  observations: ConsultationObservation[];
  conditions: Coding[];
  prescriptions: ConsultationPrescription[];
}

/** Ressources créées par une consultation. */
export interface ConsultationResources {
  encounter: Encounter;
  observations: Observation[];
  conditions: Condition[];
  medicationRequests: MedicationRequest[];
}
