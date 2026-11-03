import { makeAutoObservable, reaction, runInAction, type IReactionDisposer } from 'mobx';
import { BreakGlassViewModel } from './break-glass-view-model.js';
import type { PatientsGateway } from './gateways.js';
import { GatewayError } from './http-client.js';
import { buildSummarySections } from './summary-sections.js';
import type { LoadState } from './load-state.js';
import type {
  LocaleSource,
  PatientOverview,
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
  overview: PatientOverview | null = null;
  /** Le soignant a validé le résumé IA (aucune écriture dans le dossier). */
  summaryValidated = false;
  readonly breakGlass: BreakGlassViewModel;

  private patientId: string | null = null;
  private readonly disposeLocaleReaction: IReactionDisposer;

  constructor(
    private readonly gateway: PatientsGateway,
    private readonly i18n: LocaleSource,
    private readonly now: () => Date = () => new Date(),
  ) {
    makeAutoObservable<
      PatientRecordViewModel,
      'gateway' | 'i18n' | 'now' | 'patientId' | 'disposeLocaleReaction'
    >(
      this,
      {
        gateway: false,
        i18n: false,
        now: false,
        patientId: false,
        disposeLocaleReaction: false,
        breakGlass: false,
      },
      { autoBind: true },
    );
    this.breakGlass = new BreakGlassViewModel(
      gateway,
      i18n,
      () => this.patientId,
      () => this.reload(),
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
    this.summaryValidated = false;
    try {
      const [patient, timeline, summary, overview] = await Promise.all([
        this.gateway.patient(patientId),
        this.gateway.timeline(patientId),
        this.gateway.summary(patientId, this.i18n.locale),
        this.gateway.overview(patientId),
      ]);
      if (this.patientId !== patientId) return;
      runInAction(() => {
        this.patient = patient;
        this.timeline = timeline;
        this.summary = summary;
        this.overview = overview;
        this.state = 'ready';
      });
    } catch (error) {
      if (this.patientId !== patientId) return;
      runInAction(() => {
        this.state = error instanceof GatewayError && error.status === 403 ? 'forbidden' : 'error';
      });
    }
  }

  /** Recharge le dossier courant (après un bris de glace). */
  async reload(): Promise<void> {
    if (this.patientId !== null) await this.load(this.patientId);
  }

  /** Le soignant valide le résumé : simple accusé local, le dossier n'est pas modifié. */
  validateSummary(): void {
    this.summaryValidated = true;
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

  get age(): number | null {
    if (!this.patient) return null;
    const born = new Date(this.patient.birthDate);
    const today = this.now();
    const hadBirthday =
      today.getUTCMonth() > born.getUTCMonth() ||
      (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() >= born.getUTCDate());
    return today.getUTCFullYear() - born.getUTCFullYear() - (hadBirthday ? 0 : 1);
  }

  /** Ligne d'identité : âge, sexe, IPP, version du dossier. */
  get identityLine(): string {
    if (!this.patient || !this.overview) return '';
    return this.i18n.t('patient.identity', {
      age: this.age ?? '',
      gender: this.i18n.t(`patient.gender.${this.overview.gender}`),
      ipp: this.patient.ipp,
      version: this.overview.version,
    });
  }

  /** Badges d'alerte de l'en-tête (allergies, anticoagulant). */
  get badges(): { id: string; label: string; tone: 'danger' | 'warning' }[] {
    if (!this.overview) return [];
    const allergies = this.overview.allergies.map((label) => ({
      id: `allergy-${label}`,
      label: this.i18n.t('patient.allergy', { label }),
      tone: 'danger' as const,
    }));
    const anticoagulant = this.overview.anticoagulant
      ? [{ id: 'anticoagulant', label: this.i18n.t('patient.anticoagulant'), tone: 'warning' as const }]
      : [];
    return [...allergies, ...anticoagulant];
  }

  /** Résumé IA découpé en sections avec sources numérotées ; `null` tant qu'il n'est pas chargé. */
  get summaryView(): ReturnType<typeof buildSummarySections> | null {
    return this.summary ? buildSummarySections(this.summary) : null;
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
