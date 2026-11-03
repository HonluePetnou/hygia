import { makeAutoObservable, runInAction } from 'mobx';
import type { PatientsGateway } from './gateways.js';
import type { LoadState } from './load-state.js';
import type { LocaleSource, PatientSummary } from './types.js';

/**
 * Accès minimal requis par la recherche : le web la branche sur le service Dossiers, le mobile
 * sur sa base SQLite locale (même vue-modèle, donnée locale ou distante).
 */
export type PatientSearchGateway = Pick<PatientsGateway, 'search'>;

/** Liste des patients avec recherche par nom ou IPP. */
export class PatientSearchViewModel {
  state: LoadState = 'idle';
  query = '';
  results: PatientSummary[] = [];

  /** Numéro de la dernière recherche lancée : écarte les réponses périmées. */
  private sequence = 0;

  constructor(
    private readonly gateway: PatientSearchGateway,
    private readonly i18n: LocaleSource,
  ) {
    makeAutoObservable<PatientSearchViewModel, 'gateway' | 'i18n' | 'sequence'>(
      this,
      { gateway: false, i18n: false, sequence: false },
      { autoBind: true },
    );
  }

  /** Met à jour la requête et relance la recherche. */
  async setQuery(query: string): Promise<void> {
    this.query = query;
    await this.search();
  }

  async search(): Promise<void> {
    const current = ++this.sequence;
    this.state = 'loading';
    try {
      const results = await this.gateway.search(this.query.trim());
      if (current !== this.sequence) return;
      runInAction(() => {
        this.results = results;
        this.state = 'ready';
      });
    } catch {
      if (current !== this.sequence) return;
      runInAction(() => {
        this.state = 'error';
      });
    }
  }

  get errorMessage(): string | null {
    return this.state === 'error' ? this.i18n.t('error.generic') : null;
  }

  get emptyMessage(): string | null {
    return this.state === 'ready' && this.results.length === 0
      ? this.i18n.t('patients.empty')
      : null;
  }
}
