import type { Change, Conflict } from './change.js';
import { VectorClock } from './vector-clock.js';

/** Résultat de la fusion. */
export interface MergeResult {
  /** Changements retenus, sans doublon : union des ajouts, valeur gagnante de chaque champ. */
  merged: Change[];
  /** Champs modifiés en parallèle avec des valeurs différentes (absents de `merged`). */
  conflicts: Conflict[];
}

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const clockOf = (change: Change): VectorClock => new VectorClock(change.clock);

/** Versions d'un champ qui ne sont dominées par aucune autre. */
function maximal(candidates: Change[]): Change[] {
  return candidates.filter(
    (c) => !candidates.some((o) => o !== c && clockOf(c).compare(clockOf(o)) === 'before'),
  );
}

/**
 * Fusionne deux listes de changements sans perte ni doublon (RF19, section 7.5).
 *
 * Les ajouts fusionnent toujours. Pour un champ, la version dont l'horloge domine gagne ; si
 * deux versions sont concurrentes avec des valeurs différentes, c'est un conflit (le champ
 * n'est alors pas dans `merged`). Deux versions concurrentes de même valeur ne sont pas un conflit.
 *
 * @param local Changements de l'appelant.
 * @param remote Changements connus de l'autre partie (serveur).
 */
export function mergeChanges(local: readonly Change[], remote: readonly Change[]): MergeResult {
  const remoteKeys = new Set(remote.map((c) => c.key));
  const unique = new Map<string, Change>();
  for (const change of [...remote, ...local]) {
    if (!unique.has(change.key)) unique.set(change.key, change);
  }

  const merged: Change[] = [];
  const conflicts: Conflict[] = [];
  const fields = new Map<string, Change[]>();
  for (const change of unique.values()) {
    if (change.kind === 'add') {
      merged.push(change);
      continue;
    }
    const id = JSON.stringify([change.resourceId, change.field]);
    fields.set(id, [...(fields.get(id) ?? []), change]);
  }

  for (const group of fields.values()) {
    const top = maximal(group).sort((a, b) => a.key.localeCompare(b.key));
    const first = top[0] as Change;
    const other = top.find((c) => !sameValue(c.value, first.value));
    if (other === undefined) {
      merged.push(first);
      continue;
    }
    // `remote` = la version connue du serveur ; à défaut, la seconde.
    const firstIsRemote = remoteKeys.has(first.key) && !remoteKeys.has(other.key);
    conflicts.push({
      resourceId: first.resourceId,
      patientId: first.patientId,
      field: first.field,
      local: firstIsRemote ? other : first,
      remote: firstIsRemote ? first : other,
    });
  }
  return { merged, conflicts };
}
