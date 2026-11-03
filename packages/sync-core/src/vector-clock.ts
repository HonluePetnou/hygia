/** Compteurs par nœud (terminal ou serveur), forme sérialisable d'une horloge. */
export type ClockRecord = Readonly<Record<string, number>>;

/** Résultat de la comparaison de deux horloges, du point de vue de la première. */
export type ClockOrder = 'before' | 'after' | 'equal' | 'concurrent';

/**
 * Horloge vectorielle immuable : un compteur par nœud. Toutes les opérations renvoient une
 * nouvelle horloge.
 */
export class VectorClock {
  private readonly counters: ClockRecord;

  constructor(counters: ClockRecord = {}) {
    const clean: Record<string, number> = {};
    for (const [node, count] of Object.entries(counters)) {
      if (!Number.isInteger(count) || count < 0) {
        throw new RangeError(`Compteur invalide pour « ${node} » : ${count}`);
      }
      if (count > 0) clean[node] = count;
    }
    this.counters = clean;
  }

  /** Compteur d'un nœud (0 s'il est inconnu). */
  get(node: string): number {
    return this.counters[node] ?? 0;
  }

  /** Nouvelle horloge où le compteur de `node` est augmenté de 1. */
  increment(node: string): VectorClock {
    return new VectorClock({ ...this.counters, [node]: this.get(node) + 1 });
  }

  /** Borne supérieure : maximum de chaque compteur (commutative, associative, idempotente). */
  merge(other: VectorClock): VectorClock {
    const result: Record<string, number> = { ...this.counters };
    for (const [node, count] of Object.entries(other.counters)) {
      result[node] = Math.max(result[node] ?? 0, count);
    }
    return new VectorClock(result);
  }

  /**
   * Compare avec une autre horloge : `before` si celle-ci est dominée, `after` si elle domine,
   * `equal` si identiques, `concurrent` si aucune ne domine l'autre.
   */
  compare(other: VectorClock): ClockOrder {
    let lower = false;
    let greater = false;
    for (const node of new Set([...Object.keys(this.counters), ...Object.keys(other.counters)])) {
      const a = this.get(node);
      const b = other.get(node);
      if (a < b) lower = true;
      if (a > b) greater = true;
    }
    if (lower && greater) return 'concurrent';
    if (lower) return 'before';
    if (greater) return 'after';
    return 'equal';
  }

  /** Forme sérialisable (JSON). */
  toJSON(): ClockRecord {
    return { ...this.counters };
  }
}
