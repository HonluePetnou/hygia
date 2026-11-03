import { makeAutoObservable, runInAction } from 'mobx';
import type { PatientsGateway } from './gateways.js';

/** Nombre d'alertes IA ouvertes (pastille de la barre latérale). */
export class OpenAlertsViewModel {
  count = 0;

  constructor(private readonly gateway: PatientsGateway) {
    makeAutoObservable<OpenAlertsViewModel, 'gateway'>(this, { gateway: false }, { autoBind: true });
  }

  /** Relit les alertes ouvertes ; en cas d'erreur la pastille garde sa valeur. */
  async refresh(): Promise<void> {
    try {
      const open = await this.gateway.alerts('ouvertes');
      runInAction(() => {
        this.count = open.length;
      });
    } catch {
      // La pastille est accessoire : elle ne doit jamais bloquer la navigation.
    }
  }
}
