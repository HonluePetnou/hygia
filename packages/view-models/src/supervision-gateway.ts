import type { ExperimentId, SupervisionData } from './supervision-types.js';

/** Supervision et module de pannes (broker, rôle admin). */
export interface SupervisionGateway {
  /** État des services, courbe de latence, expériences et exercice en cours. */
  load(): Promise<SupervisionData>;
  /** Lance une expérience de panne ; renvoie le nouvel état. */
  start(id: ExperimentId): Promise<SupervisionData>;
  /** Arrête une expérience ; renvoie le nouvel état. */
  stop(id: ExperimentId): Promise<SupervisionData>;
  /** Arrête toutes les expériences (« Arrêter l'exercice »). */
  stopExercise(): Promise<SupervisionData>;
}
