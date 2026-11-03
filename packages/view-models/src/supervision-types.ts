/** Identifiants des 8 services supervisés, dans l'ordre de la maquette 10. */
export const SUPERVISED_SERVICES = [
  'dossiers',
  'ingestion',
  'ia-clinique',
  'agents',
  'identite',
  'synchronisation',
  'notification',
  'audit',
] as const;
export type SupervisedService = (typeof SUPERVISED_SERVICES)[number];

/** Expériences de pannes (RF27). */
export const EXPERIMENT_IDS = ['zone-cut', 'instance-stop', 'latency', 'llm-down'] as const;
export type ExperimentId = (typeof EXPERIMENT_IDS)[number];

export type ServiceHealth = 'ok' | 'degraded' | 'down' | 'unconfigured';
export type ZoneId = 'a' | 'b';

export interface InstanceData {
  id: string;
  zone: ZoneId;
  up: boolean;
}

export interface ServiceData {
  id: SupervisedService;
  status: ServiceHealth;
  instances: InstanceData[];
  /** p95 mesuré par le broker en ms ; `null` sans requête. */
  p95Ms: number | null;
  requests: number;
  errors: number;
}

export interface LatencyPointData {
  /** Début de la tranche (ISO 8601). */
  at: string;
  p95Ms: number;
  count: number;
}

export interface ExperimentData {
  id: ExperimentId;
  active: boolean;
  since?: string;
}

export interface ExerciseData {
  active: boolean;
  since?: string;
  headline?: ExperimentId;
  userErrors: number;
  failovers: number;
}

/** Réponse de `GET /api/supervision` (broker). */
export interface SupervisionData {
  generatedAt: string;
  services: ServiceData[];
  latency: { objectiveMs: number; sloMet: boolean; points: LatencyPointData[] };
  experiments: ExperimentData[];
  exercise: ExerciseData;
}
