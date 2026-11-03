/** Code médical (CIM-10, ATC, LOINC). */
export interface ScribeCoding {
  system: string;
  code: string;
  display: string;
}

/** Mesure relevée pendant la consultation. */
export interface ScribeObservation {
  code: ScribeCoding;
  value: number;
  unit: string;
}

/** Prescription proposée par le scribe. */
export interface ScribePrescription {
  medication: ScribeCoding;
  doseValue: number;
  doseUnit: string;
  timesPerDay: number;
  note?: string;
}

/** Brouillon structuré (FHIR) renvoyé par le service IA clinique. */
export interface ScribeDraftData {
  motif: string;
  examen: string;
  observations: ScribeObservation[];
  diagnostics: ScribeCoding[];
  prescriptions: ScribePrescription[];
}

/** Étapes d'une séance côté serveur. */
export type ScribeStatus = 'recording' | 'draft_ready' | 'validated' | 'rejected';

/** Séance de scribe telle que renvoyée par l'API. */
export interface ScribeSessionData {
  id: string;
  patientId: string;
  status: ScribeStatus;
  durationSeconds?: number;
  audioStored: boolean;
  draft?: ScribeDraftData;
  createdResourceIds?: string[];
}

/** Audio enregistré, prêt à l'envoi. */
export interface RecordedAudio {
  base64: string;
  durationSeconds: number;
}

/** Capture audio propre à la plateforme (micro du navigateur, du téléphone). */
export interface AudioRecorder {
  /** Démarre la capture ; refuse si le micro est indisponible. */
  start(): Promise<void>;
  /** Arrête la capture et renvoie l'audio. */
  stop(): Promise<RecordedAudio>;
  /** Niveau sonore courant entre 0 et 1 (onde animée). */
  level(): number;
}
