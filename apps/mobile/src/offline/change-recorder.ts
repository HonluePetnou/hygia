import { VectorClock, type Change } from '@hygia/sync-core';
import type { LocalStore } from './local-store.js';

/** Ressource qui porte les constantes et observations d'un patient (collections `add`). */
export const dossierResource = (patientId: string): string => `Dossier/${patientId}`;

/**
 * Enregistre les modifications faites sur l'appareil : incrémente l'horloge vectorielle de la
 * ressource pour ce terminal, puis met le changement en file d'envoi. La clé d'idempotence
 * (terminal, ressource, compteur) est stable : rejouer un lot ne crée aucun doublon.
 */
export class ChangeRecorder {
  constructor(
    private readonly store: LocalStore,
    private readonly nodeId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Ajoute une entrée (`add`) ou fixe un champ (`set`) d'une ressource d'un patient. */
  async record(
    patientId: string,
    resourceId: string,
    kind: Change['kind'],
    field: string,
    value: unknown,
  ): Promise<Change> {
    const clock = new VectorClock(await this.store.clocks.get(resourceId)).increment(this.nodeId);
    const change: Change = {
      key: `${this.nodeId}:${resourceId}:${clock.get(this.nodeId)}`,
      resourceId,
      patientId,
      kind,
      field,
      value,
      clock: clock.toJSON(),
      nodeId: this.nodeId,
      at: this.now().toISOString(),
    };
    await this.store.clocks.set(resourceId, clock.toJSON());
    await this.store.changes.enqueue(change);
    return change;
  }
}
