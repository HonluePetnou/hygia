import { makeAutoObservable, runInAction } from 'mobx';
import type { PatientsGateway } from './gateways.js';
import type { LoadState } from './load-state.js';
import type { ConsultationSummary, DashboardData, LocaleSource } from './types.js';

/** Indicateur chiffré du tableau de bord. */
export interface Indicator {
  id: 'patientsToday' | 'pendingAlerts' | 'documentsImported';
  label: string;
  value: number;
}

/** Alerte ouverte avec son texte traduit. */
export interface DashboardAlert {
  id: string;
  patientId: string;
  severity: 'low' | 'moderate' | 'high';
  text: string;
}

/** Tableau de bord : indicateurs, consultations du jour, alertes ouvertes. */
export class DashboardViewModel {
  state: LoadState = 'idle';
  data: DashboardData | null = null;

  constructor(
    private readonly gateway: PatientsGateway,
    private readonly i18n: LocaleSource,
  ) {
    makeAutoObservable<DashboardViewModel, 'gateway' | 'i18n'>(
      this,
      { gateway: false, i18n: false },
      { autoBind: true },
    );
  }

  async load(): Promise<void> {
    this.state = 'loading';
    try {
      const data = await this.gateway.dashboard();
      runInAction(() => {
        this.data = data;
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

  get errorMessage(): string | null {
    return this.state === 'error' ? this.i18n.t('error.generic') : null;
  }

  get consultations(): ConsultationSummary[] {
    return this.data?.consultations ?? [];
  }

  get alerts(): DashboardAlert[] {
    return (this.data?.alerts ?? []).map((a) => ({
      id: a.id,
      patientId: a.patientId,
      severity: a.severity,
      text: this.i18n.t(`summary.alert.${a.kind}`, a.params),
    }));
  }

  get indicators(): Indicator[] {
    const { t } = this.i18n;
    const patients = new Set(this.consultations.map((c) => c.patientId));
    return [
      { id: 'patientsToday', label: t('dashboard.patientsToday'), value: patients.size },
      { id: 'pendingAlerts', label: t('dashboard.pendingAlerts'), value: this.alerts.length },
      {
        id: 'documentsImported',
        label: t('dashboard.documentsImported'),
        value: this.data?.documentsImported ?? 0,
      },
    ];
  }
}
