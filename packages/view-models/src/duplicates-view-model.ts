import { makeAutoObservable, runInAction } from 'mobx';
import type { PatientsGateway } from './gateways.js';
import type { LoadState } from './load-state.js';
import type { DuplicateCandidate, LocaleSource, PatientSummary } from './types.js';

/** Bandeau « doublon probable » prêt à afficher. */
export interface DuplicateBanner {
  id: string;
  /** Texte complet du bandeau. */
  message: string;
  percent: number;
}

const percentOf = (score: number): number => Math.round(score * 100);

/** Bandeaux de doublons de la liste des patients, avec « Ignorer ». */
export class DuplicatesViewModel {
  state: LoadState = 'idle';
  candidates: DuplicateCandidate[] = [];

  constructor(
    private readonly gateway: PatientsGateway,
    private readonly i18n: LocaleSource,
  ) {
    makeAutoObservable<DuplicatesViewModel, 'gateway' | 'i18n'>(
      this,
      { gateway: false, i18n: false },
      { autoBind: true },
    );
  }

  async load(): Promise<void> {
    this.state = 'loading';
    try {
      const candidates = await this.gateway.duplicates();
      runInAction(() => {
        this.candidates = candidates;
        this.state = 'ready';
      });
    } catch {
      // Les bandeaux sont accessoires : une erreur ne bloque pas la liste des patients.
      runInAction(() => {
        this.candidates = [];
        this.state = 'error';
      });
    }
  }

  /** Ignore un doublon : le bandeau disparaît une fois le service informé. */
  async ignore(id: string): Promise<void> {
    await this.gateway.ignoreDuplicate(id);
    runInAction(() => {
      this.candidates = this.candidates.filter((candidate) => candidate.id !== id);
    });
  }

  get banners(): DuplicateBanner[] {
    const describe = (patient: PatientSummary): [string, string, string] => [
      `${patient.givenName} ${patient.familyName}`,
      patient.ipp,
      patient.managingOrganization?.display ?? this.i18n.t('duplicate.unknownOrg'),
    ];
    return this.candidates.map(({ id, score, a, b }) => {
      const [aName, aIpp, aOrg] = describe(a);
      const [bName, bIpp, bOrg] = describe(b);
      const percent = percentOf(score);
      return {
        id,
        percent,
        message: this.i18n.t('duplicate.banner', { percent, a: aName, aIpp, aOrg, b: bName, bIpp, bOrg }),
      };
    });
  }
}
