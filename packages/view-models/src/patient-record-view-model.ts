import { makeAutoObservable, reaction, runInAction, type IReactionDisposer } from 'mobx';
import type { PatientsGateway } from './gateways.js';
import type { LoadState } from './load-state.js';
import type {
  LocaleSource,
  PatientSummary,
  Resume,
  TimelineEntry,
  TimelineEntryType,
} from './types.js';

/** Filtres de la chronologie. */
export type TimelineFilter = 'all' | 'consultations' | 'exams' | 'prescriptions' | 'alerts';

const FILTER_TYPES: Record<TimelineFilter, readonly TimelineEntryType[] | null> = {
  all: null,
  consultations: ['consultation'],
  exams: ['examen'],
  prescriptions: ['prescription'],
  alerts: ['alerte'],
};

/** Ordre d'affichage des filtres. */
export const TIMELINE_FILTERS: readonly TimelineFilter[] = [
  'all',
  'consultations',
  'exams',
  'prescriptions',
  'alerts',
];

/** Dossier d'un patient : fiche, chronologie filtrable et résumé pré-consultation. */
export class PatientRecordViewModel {
  state: LoadState = 'idle';
  patient: PatientSummary | null = null;
  timeline: TimelineEntry[] = [];
  summary: Resume | null = null;
  filter: TimelineFilter = 'all';

  private patientId: string | null = null;
  private readonly disposeLocaleReaction: IReactionDisposer;

  constructor(
    private readonly gateway: PatientsGateway,
    private readonly i18n: LocaleSource,
  ) {
    makeAutoObservable<
      PatientRecordViewModel,
      'gateway' | 'i18n' | 'patientId' | 'disposeLocaleReaction'
    >(
      this,
      { gateway: false, i18n: false, patientId: false, disposeLocaleReaction: false },
      { autoBind: true },
    );
    // Le résumé est produit côté serveur dans une langue : on le redemande quand elle change.
    this.disposeLocaleReaction = reaction(
      () => this.i18n.locale,
      () => void this.refreshSummary(),
    );
  }

  /** Charge la fiche, la chronologie et le résumé. */
  async load(patientId: string): Promise<void> {
    this.patientId = patientId;
    this.state = 'loading';
    try {
      const [patient, timeline, summary] = await Promise.all([
        this.gateway.patient(patientId),
        this.gateway.timeline(patientId),
        this.gateway.summary(patientId, this.i18n.locale),
      ]);
      if (this.patientId !== patientId) return;
      runInAction(() => {
        this.patient = patient;
        this.timeline = timeline;
        this.summary = summary;
        this.state = 'ready';
      });
    } catch {
      if (this.patientId !== patientId) return;
      runInAction(() => {
        this.state = 'error';
      });
    }
  }

  /** Redemande le résumé dans la langue courante. */
  async refreshSummary(): Promise<void> {
    const patientId = this.patientId;
    if (patientId === null || this.state !== 'ready') return;
    try {
      const summary = await this.gateway.summary(patientId, this.i18n.locale);
      if (this.patientId !== patientId || summary.language !== this.i18n.locale) return;
      runInAction(() => {
        this.summary = summary;
      });
    } catch {
      runInAction(() => {
        this.state = 'error';
      });
    }
  }

  setFilter(filter: TimelineFilter): void {
    this.filter = filter;
  }

  /** Chronologie après application du filtre. */
  get visibleTimeline(): TimelineEntry[] {
    const types = FILTER_TYPES[this.filter];
    return types ? this.timeline.filter((e) => types.includes(e.type)) : this.timeline;
  }

  /** Filtres avec libellés traduits. */
  get filters(): { id: TimelineFilter; label: string; selected: boolean }[] {
    return TIMELINE_FILTERS.map((id) => ({
      id,
      label: this.i18n.t(`patient.filter.${id}`),
      selected: id === this.filter,
    }));
  }

  get fullName(): string {
    return this.patient ? `${this.patient.givenName} ${this.patient.familyName}` : '';
  }

  get errorMessage(): string | null {
    return this.state === 'error' ? this.i18n.t('error.generic') : null;
  }

  get timelineEmptyMessage(): string | null {
    return this.state === 'ready' && this.visibleTimeline.length === 0
      ? this.i18n.t('patient.timeline.empty')
      : null;
  }

  /** Libellés des onglets et du bloc pré-consultation. */
  get labels(): {
    timeline: string;
    preConsultation: string;
    generatedByAi: string;
    validate: string;
  } {
    const { t } = this.i18n;
    return {
      timeline: t('patient.timeline.title'),
      preConsultation: t('patient.preConsultation.title'),
      generatedByAi: t('patient.preConsultation.generatedByAi'),
      validate: t('patient.preConsultation.validate'),
    };
  }

  /** Libère la réaction sur la langue (à appeler au démontage de la vue). */
  dispose(): void {
    this.disposeLocaleReaction();
  }
}
