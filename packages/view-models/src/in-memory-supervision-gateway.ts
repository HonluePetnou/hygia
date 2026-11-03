import type { SupervisionGateway } from './supervision-gateway.js';
import {
  EXPERIMENT_IDS,
  SUPERVISED_SERVICES,
  type ExerciseData,
  type ExperimentId,
  type LatencyPointData,
  type ServiceData,
  type SupervisedService,
  type SupervisionData,
} from './supervision-types.js';

const BASE_P95: Record<SupervisedService, number> = {
  dossiers: 182,
  ingestion: 410,
  'ia-clinique': 1400,
  agents: 2100,
  identite: 96,
  synchronisation: 240,
  notification: 800,
  audit: 35,
};

/**
 * Supervision simulée pour la démonstration hors ligne et les tests : les expériences changent
 * l'état des instances comme le fait le broker (zone a coupée → tout passe par la zone b).
 */
export class InMemorySupervisionGateway implements SupervisionGateway {
  private readonly started = new Map<ExperimentId, string>();

  constructor(private readonly now: () => Date = () => new Date('2026-10-28T10:14:00Z')) {}

  load(): Promise<SupervisionData> {
    return Promise.resolve(this.view());
  }

  start(id: ExperimentId): Promise<SupervisionData> {
    if (!this.started.has(id)) this.started.set(id, this.now().toISOString());
    return this.load();
  }

  stop(id: ExperimentId): Promise<SupervisionData> {
    this.started.delete(id);
    return this.load();
  }

  stopExercise(): Promise<SupervisionData> {
    this.started.clear();
    return this.load();
  }

  private view(): SupervisionData {
    const zoneCut = this.started.has('zone-cut');
    const stopped = this.started.has('instance-stop');
    const slow = this.started.has('latency');
    const services: ServiceData[] = SUPERVISED_SERVICES.map((id) => {
      const instances = (['a', 'b'] as const).map((zone) => ({
        id: `${id}-${zone}`,
        zone,
        up: !(zoneCut && zone === 'a') && !(stopped && id === 'dossiers' && zone === 'a'),
      }));
      const p95Ms = BASE_P95[id] + (slow && id === 'ia-clinique' ? 800 : 0);
      return {
        id,
        // Même règle que le broker : une instance arrêtée ou un p95 > 500 ms = « dégradé ».
        status: instances.some((i) => !i.up) || p95Ms > 500 ? 'degraded' : 'ok',
        instances,
        p95Ms,
        requests: 120,
        errors: 0,
      };
    });
    const points: LatencyPointData[] = Array.from({ length: 12 }, (_, i) => ({
      at: new Date(Date.parse('2026-10-28T10:10:00Z') + i * 10_000).toISOString(),
      p95Ms: zoneCut && i === 4 ? 410 : 180 + (i % 3) * 4,
      count: 20,
    }));
    const exercise: ExerciseData =
      this.started.size === 0
        ? { active: false, userErrors: 0, failovers: 0 }
        : {
            active: true,
            since: [...this.started.values()][0] ?? this.now().toISOString(),
            headline: this.started.has('zone-cut') ? 'zone-cut' : ([...this.started.keys()][0] ?? 'zone-cut'),
            userErrors: 0,
            failovers: zoneCut ? 3 : 0,
          };
    return {
      generatedAt: this.now().toISOString(),
      services,
      latency: { objectiveMs: 2000, sloMet: true, points },
      experiments: EXPERIMENT_IDS.map((id) => {
        const since = this.started.get(id);
        return since === undefined ? { id, active: false } : { id, active: true, since };
      }),
      exercise,
    };
  }
}
