import { EXPERIMENT_IDS, applyExperiment, type ExperimentId } from './experiments.js';
import type { FaultState } from './fault-state.js';

/** Expérience telle que la voit l'écran de supervision. */
export interface ExperimentStatus {
  id: ExperimentId;
  active: boolean;
  /** Début de l'expérience (ISO 8601) si elle est en cours. */
  since?: string;
}

/** Exercice de panne : au moins une expérience en cours. */
export interface ExerciseStatus {
  active: boolean;
  /** Début de l'exercice (première expérience lancée). */
  since?: string;
  /** Expérience mise en avant dans le bandeau (la coupure de zone si présente). */
  headline?: ExperimentId;
  /** Réponses 5xx renvoyées aux clients depuis le début de l'exercice. */
  userErrors: number;
  /** Requêtes basculées sur une autre instance depuis le début de l'exercice. */
  failovers: number;
}

/** Lance et arrête les expériences de pannes (rôle admin) et suit l'exercice en cours. */
export class ExperimentService {
  private readonly started = new Map<ExperimentId, number>();
  private exerciseStart: { at: number; errors: number; failovers: number } | undefined;

  constructor(
    private readonly state: FaultState,
    private readonly counters: () => { userErrors: number; failovers: number },
    private readonly now: () => number = Date.now,
  ) {}

  /** @returns `false` si l'identifiant est inconnu. */
  start(id: string): boolean {
    if (!isExperiment(id)) return false;
    if (!this.started.has(id)) {
      this.exerciseStart ??= { at: this.now(), ...this.snapshotCounters() };
      this.started.set(id, this.now());
      applyExperiment(this.state, id, true);
    }
    return true;
  }

  /** @returns `false` si l'identifiant est inconnu. */
  stop(id: string): boolean {
    if (!isExperiment(id)) return false;
    if (this.started.delete(id)) applyExperiment(this.state, id, false);
    if (this.started.size === 0) this.exerciseStart = undefined;
    return true;
  }

  /** « Arrêter l'exercice » : retire toutes les pannes. */
  stopAll(): void {
    for (const id of [...this.started.keys()]) this.stop(id);
  }

  list(): ExperimentStatus[] {
    return EXPERIMENT_IDS.map((id) => {
      const at = this.started.get(id);
      return at === undefined ? { id, active: false } : { id, active: true, since: new Date(at).toISOString() };
    });
  }

  exercise(): ExerciseStatus {
    const begin = this.exerciseStart;
    if (begin === undefined) return { active: false, userErrors: 0, failovers: 0 };
    const now = this.snapshotCounters();
    const headline = this.started.has('zone-cut') ? 'zone-cut' : [...this.started.keys()][0];
    return {
      active: true,
      since: new Date(begin.at).toISOString(),
      ...(headline === undefined ? {} : { headline }),
      userErrors: now.errors - begin.errors,
      failovers: now.failovers - begin.failovers,
    };
  }

  private snapshotCounters(): { errors: number; failovers: number } {
    const { userErrors, failovers } = this.counters();
    return { errors: userErrors, failovers };
  }
}

function isExperiment(id: string): id is ExperimentId {
  return (EXPERIMENT_IDS as readonly string[]).includes(id);
}
