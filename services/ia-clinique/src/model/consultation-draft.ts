import type { Coding, Language } from '@hygia/types';

/** Mesure relevée pendant la consultation. */
export interface DraftObservation {
  code: Coding;
  value: number;
  unit: string;
}

/** Prescription proposée par le modèle (à valider par le médecin). */
export interface DraftPrescription {
  /** Médicament, code ATC. */
  medication: Coding;
  doseValue: number;
  doseUnit: string;
  timesPerDay: number;
  /** Consigne de suivi (ex. « contrôle dans 4 semaines »), non enregistrée comme ressource. */
  note?: string;
}

/**
 * Brouillon structuré d'une consultation (RF9) : motif, examen, diagnostic CIM-10 et prescriptions,
 * prêts à devenir des ressources FHIR une fois validés par le médecin.
 */
export interface ConsultationDraft {
  motif: string;
  examen: string;
  observations: DraftObservation[];
  /** Diagnostics CIM-10. */
  diagnostics: Coding[];
  prescriptions: DraftPrescription[];
}

/** Demande de structuration d'une transcription. */
export interface StructuringRequest {
  transcript: string;
  language: Language;
}
