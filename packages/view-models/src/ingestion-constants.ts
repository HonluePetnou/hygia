import type { IngestionStepId, IngestionStepStatus } from './types.js';

/** Étapes de la chaîne principale, dans l'ordre. */
export const STEP_IDS: readonly IngestionStepId[] = [
  'reception',
  'ocr',
  'normalization',
  'aiExtraction',
  'identifierDetection',
];

/** Clé de libellé de chaque statut. */
export const STATUS_KEYS: Record<IngestionStepStatus, string> = {
  pending: 'status.pending',
  inProgress: 'status.inProgress',
  done: 'status.done',
  failed: 'status.failed',
};

/** Canaux d'entrée (compteurs de démonstration : documents reçus aujourd'hui). */
export const CHANNELS = [
  { id: 'web', count: 38 },
  { id: 'mobile', count: 21 },
  { id: 'fhir', count: 112 },
  { id: 'whatsapp', count: 9 },
] as const;
