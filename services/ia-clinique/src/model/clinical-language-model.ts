import type { Language } from '@hygia/types';
import type { Passage } from '../index/passage-index.js';
import type { ConsultationDraft, StructuringRequest } from './consultation-draft.js';

/** Jeton d'injection de `ClinicalLanguageModel`. */
export const CLINICAL_LANGUAGE_MODEL = Symbol('CLINICAL_LANGUAGE_MODEL');

/** Demande de génération : le modèle ne doit utiliser que `passages`. */
export interface GenerationRequest {
  question: string;
  /** Passages numérotés à partir de 1 dans l'ordre fourni (marqueurs `[n]`). */
  passages: readonly Passage[];
  /** Langue de la réponse. */
  language: Language;
}

/**
 * Modèle de langage clinique (section 5.4). Implémentation simulée en local, Amazon Bedrock
 * ensuite. La réponse cite ses sources par des marqueurs `[n]` renvoyant à `passages[n - 1]`.
 */
export interface ClinicalLanguageModel {
  generate(request: GenerationRequest): Promise<string>;
  /** Structure la transcription d'une consultation en brouillon (jamais écrit au dossier sans validation). */
  structureConsultation(request: StructuringRequest): Promise<ConsultationDraft>;
}
