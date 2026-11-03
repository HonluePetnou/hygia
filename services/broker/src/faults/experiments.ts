import type { FaultState } from './fault-state.js';

/** Identifiants des expériences de pannes (maquette 10, RF27). */
export const EXPERIMENT_IDS = ['zone-cut', 'instance-stop', 'latency', 'llm-down'] as const;
export type ExperimentId = (typeof EXPERIMENT_IDS)[number];

/** Zone coupée par l'expérience `zone-cut`. */
export const CUT_ZONE = 'a';
/** Instance arrêtée par l'expérience `instance-stop` (Dossiers patients, zone a). */
export const STOPPED_INSTANCE = 'dossiers-a';
/** Service ralenti par l'expérience `latency`, et latence ajoutée. */
export const SLOWED_SERVICE = 'ia-clinique';
export const ADDED_LATENCY_MS = 800;

/** Applique ou retire la panne d'une expérience. */
export function applyExperiment(state: FaultState, id: ExperimentId, on: boolean): void {
  switch (id) {
    case 'zone-cut':
      state.cutZone(CUT_ZONE, on);
      break;
    case 'instance-stop':
      state.stopInstance(STOPPED_INSTANCE, on);
      break;
    case 'latency':
      state.setLatency(SLOWED_SERVICE, on ? ADDED_LATENCY_MS : 0);
      break;
    case 'llm-down':
      state.setLlmUnavailable(on);
      break;
  }
}
