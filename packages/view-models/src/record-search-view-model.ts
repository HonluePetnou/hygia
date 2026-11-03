import { makeAutoObservable, runInAction } from 'mobx';
import type { ExportDownload } from './export-download.js';
import type { PatientsGateway } from './gateways.js';
import type { LoadState } from './load-state.js';
import type { LocaleSource, SearchFilter, SearchResultRow } from './types.js';

/** Nombre de lignes par page du tableau des résultats. */
export const SEARCH_PAGE_SIZE = 10;

/**
 * Recherche multicritère et en langage naturel (RF14) : la requête est interprétée en filtres
 * (puces « Compris comme »), supprimer une puce relance la recherche avec les filtres restants.
 */
export class RecordSearchViewModel {
  state: LoadState = 'idle';
  /** Texte saisi dans la barre de recherche. */
  query = '';
  /** Filtres compris, affichés sous forme de puces. */
  filters: SearchFilter[] = [];
  results: SearchResultRow[] = [];
  total = 0;
  page = 1;
  /** Dernier export CSV en échec. */
  exportFailed = false;

  /** Numéro de la dernière recherche lancée : écarte les réponses périmées. */
  private sequence = 0;

  constructor(
    private readonly gateway: PatientsGateway,
    private readonly i18n: LocaleSource,
  ) {
    makeAutoObservable<RecordSearchViewModel, 'gateway' | 'i18n' | 'sequence'>(
      this,
      { gateway: false, i18n: false, sequence: false },
      { autoBind: true },
    );
  }

  setQuery(query: string): void {
    this.query = query;
  }

  /** Interprète la requête saisie et lance la recherche (première page). */
  async submit(query: string = this.query): Promise<void> {
    this.query = query;
    await this.run({ requete: query.trim() }, 1);
  }

  /** Supprime la puce `index` et relance la recherche avec les filtres restants. */
  async removeFilter(index: number): Promise<void> {
    const remaining = this.filters.filter((_, i) => i !== index);
    await this.run({ filtres: remaining }, 1);
  }

  /** Affiche la page `page` (à partir de 1) des mêmes filtres. */
  async goToPage(page: number): Promise<void> {
    if (page < 1 || page > this.pageCount) return;
    await this.run({ filtres: this.filters }, page);
  }

  /** CSV de tous les résultats de la recherche courante (audité côté serveur) ; `null` en cas d'échec. */
  async exportCsv(): Promise<ExportDownload | null> {
    try {
      const blob = await this.gateway.exportSearch({ filtres: this.filters }, this.i18n.locale);
      runInAction(() => (this.exportFailed = false));
      return { blob, filename: 'patients.csv' };
    } catch {
      runInAction(() => (this.exportFailed = true));
      return null;
    }
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.total / SEARCH_PAGE_SIZE));
  }

  get hasPrevious(): boolean {
    return this.page > 1;
  }

  get hasNext(): boolean {
    return this.page < this.pageCount;
  }

  get errorMessage(): string | null {
    return this.state === 'error' ? this.i18n.t('error.generic') : null;
  }

  get emptyMessage(): string | null {
    return this.state === 'ready' && this.results.length === 0
      ? this.i18n.t('patients.empty')
      : null;
  }

  private async run(
    criteria: { requete: string } | { filtres: SearchFilter[] },
    page: number,
  ): Promise<void> {
    const current = ++this.sequence;
    this.state = 'loading';
    try {
      const response = await this.gateway.searchRecords({ ...criteria, page, taille: SEARCH_PAGE_SIZE });
      if (current !== this.sequence) return;
      runInAction(() => {
        this.filters = response.filtres;
        this.results = response.resultats;
        this.total = response.total;
        this.page = response.page;
        this.state = 'ready';
      });
    } catch {
      if (current !== this.sequence) return;
      runInAction(() => {
        this.state = 'error';
      });
    }
  }
}
