import { makeAutoObservable, runInAction } from 'mobx';
import type { AlertItem } from './alert-types.js';
import type { PatientsGateway } from './gateways.js';
import type { LoadState } from './load-state.js';
import type {
  ConsultationStatus,
  DashboardData,
  DocumentStage,
  LocaleSource,
} from './types.js';

/** Indicateur chiffré du tableau de bord. */
export interface Indicator {
  id: 'patientsToday' | 'pendingAlerts' | 'documentsInProgress' | 'resultsToValidate';
  label: string;
  value: number;
}

/** Alerte ouverte avec son texte traduit. */
export interface DashboardAlert {
  id: string;
  patientId: string;
  severity: 'low' | 'moderate' | 'high';
  severityLabel: string;
  text: string;
}

/** Ligne du tableau des consultations du jour. */
export interface ConsultationRow {
  id: string;
  patientId: string;
  patientName: string;
  /** Heure locale `HH:MM`. */
  time: string;
  reason: string;
  status: ConsultationStatus;
  statusLabel: string;
}

/** Document en cours avec libellés traduits. */
export interface DocumentRow {
  id: string;
  title: string;
  source: string;
  stage: DocumentStage;
  stageLabel: string;
  progress: number;
}

/** Barre de l'histogramme de la semaine. */
export interface WeekBar {
  day: string;
  label: string;
  value: number;
  /** Jour de la semaine courant (1 = lundi). */
  highlighted: boolean;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Tableau de bord : indicateurs, consultations du jour, alertes, documents, activité. */
export class DashboardViewModel {
  state: LoadState = 'idle';
  data: DashboardData | null = null;
  /** Alertes IA ouvertes du service Dossiers (source de la carte et du compteur). */
  openAlerts: AlertItem[] = [];

  constructor(
    private readonly gateway: PatientsGateway,
    private readonly i18n: LocaleSource,
    private readonly now: () => Date = () => new Date(),
  ) {
    makeAutoObservable<DashboardViewModel, 'gateway' | 'i18n' | 'now'>(
      this,
      { gateway: false, i18n: false, now: false },
      { autoBind: true },
    );
  }

  async load(): Promise<void> {
    this.state = 'loading';
    try {
      const [data, openAlerts] = await Promise.all([
        this.gateway.dashboard(),
        this.gateway.alerts('ouvertes').catch((): AlertItem[] => []),
      ]);
      runInAction(() => {
        this.data = data;
        this.openAlerts = openAlerts;
        this.state = 'ready';
      });
    } catch {
      runInAction(() => {
        this.state = 'error';
      });
    }
  }

  get title(): string {
    return this.i18n.t('dashboard.title');
  }

  /** Salutation « Bonjour, Dr Nana ». */
  greeting(name: string): string {
    return this.i18n.t('dashboard.greeting', { nom: name });
  }

  /** Sous-titre : nombre de consultations et d'alertes à examiner. */
  get subtitle(): string {
    return this.i18n.t('dashboard.subtitle', {
      consultations: this.consultations.length,
      alerts: this.alerts.length,
    });
  }

  get errorMessage(): string | null {
    return this.state === 'error' ? this.i18n.t('error.generic') : null;
  }

  get consultations(): ConsultationRow[] {
    const { t } = this.i18n;
    return (this.data?.consultations ?? [])
      .slice()
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .map((c) => {
        const start = new Date(c.start);
        const key = `encounter.class.${c.reason}`;
        const translated = t(key);
        return {
          id: c.id,
          patientId: c.patientId,
          patientName: c.patientName,
          time: `${pad(start.getUTCHours())}:${pad(start.getUTCMinutes())}`,
          reason: translated === key ? c.reason : translated,
          status: c.status,
          statusLabel: t(`consultation.status.${c.status}`),
        };
      });
  }

  get alerts(): DashboardAlert[] {
    return this.openAlerts.map((a) => ({
      id: a.id,
      patientId: a.patientId,
      severity: a.severity,
      severityLabel: this.i18n.t(`dashboard.severity.${a.severity}`),
      text: a.title,
    }));
  }

  get documents(): DocumentRow[] {
    return (this.data?.documentsInProgress ?? []).map((d) => ({
      ...d,
      stageLabel: this.i18n.t(`dashboard.stage.${d.stage}`),
    }));
  }

  /** Histogramme : un jour par barre, le jour courant en évidence. */
  get week(): WeekBar[] {
    const today = this.now().getUTCDay() || 7;
    return (this.data?.weekActivity ?? []).map((value, index) => ({
      day: String(index + 1),
      label: this.i18n.t(`weekday.${index + 1}`),
      value,
      highlighted: index + 1 === today,
    }));
  }

  get indicators(): Indicator[] {
    const { t } = this.i18n;
    const patients = new Set((this.data?.consultations ?? []).map((c) => c.patientId));
    const inProgress = (this.data?.documentsInProgress ?? []).filter((d) => d.stage !== 'done');
    return [
      { id: 'patientsToday', label: t('dashboard.patientsToday'), value: patients.size },
      { id: 'pendingAlerts', label: t('dashboard.alertsOpen'), value: this.alerts.length },
      {
        id: 'documentsInProgress',
        label: t('dashboard.documentsInProgress'),
        value: inProgress.length,
      },
      {
        id: 'resultsToValidate',
        label: t('dashboard.resultsToValidate'),
        value: this.data?.resultsToValidate ?? 0,
      },
    ];
  }
}
