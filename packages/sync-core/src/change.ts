import type { ClockRecord } from './vector-clock.js';

/**
 * Changement d'une ressource effectué par un nœud.
 *
 * - `add` : ajout d'une entrée (observation, constante…) — toujours fusionné ;
 * - `set` : valeur d'un champ (posologie…) — deux valeurs concurrentes différentes = conflit.
 */
export interface Change {
  /** Clé d'idempotence : un changement déjà vu (même clé) est ignoré. */
  key: string;
  /** Ressource modifiée (UUID). */
  resourceId: string;
  /** Dossier patient concerné (audit). */
  patientId: string;
  kind: 'add' | 'set';
  /** Champ modifié (`set`) ou collection (`add`, ex. `observations`). */
  field: string;
  value: unknown;
  /** Horloge de la ressource après le changement. */
  clock: ClockRecord;
  /** Nœud auteur. */
  nodeId: string;
  /** Horodatage ISO 8601 du changement (information, jamais utilisé pour trancher). */
  at: string;
}

/** Modification concurrente d'un même champ, à présenter au soignant. */
export interface Conflict {
  resourceId: string;
  patientId: string;
  field: string;
  /** Version côté appelant (terminal). */
  local: Change;
  /** Version côté serveur. */
  remote: Change;
}
