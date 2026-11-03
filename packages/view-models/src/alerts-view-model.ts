import { formatDateTime } from '@hygia/i18n';
import { makeAutoObservable, runInAction } from 'mobx';
import type {
  AlertAgentId,
  AlertDecisionKind,
  AlertDetailData,
  AlertItem,
  AlertStatus,
  AlertTab,
} from './alert-types.js';
import type { PatientsGateway } from './gateways.js';
import { GatewayError } from './http-client.js';
import type { LoadState } from './load-state.js';
import type { LocaleSource, PatientSummary } from './types.js';

/** Onglets dans l'ordre d'affichage. */
export const ALERT_TABS: readonly AlertTab[] = ['ouvertes', 'acceptees', 'rejetees'];

const TAB_STATUSES: Record<AlertTab, readonly AlertStatus[]> = {
  ouvertes: ['pending'],
  acceptees: ['accepted', 'accepted_notified'],
  rejetees: ['rejected'],
};

/** Ligne de la liste de gauche. */
export interface AlertRow {
  id: string;
  severity: AlertItem['severity'];
  agent: AlertAgentId;
  agentLabel: string;
  title: string;
  patientName: string;
  /** Ancienneté (« 6 min », « hier »). */
  age: string;
  selected: boolean;
}

/** Détail de l'alerte sélectionnée, textes traduits. */
export interface AlertDetailView {
  id: string;
  patientId: string;
  severity: AlertItem['severity'];
  severityLabel: string;
  agentLabel: string;
  raisedLabel: string;
  title: string;
  patientCard: { name: string; age: string; ipp: string } | null;
  steps: { step: number; title: string }[];
  sources: { n: number; label: string; excerpt: string }[];
  proposal: string;
  /** Texte de la précision de l'agent sur 30 jours. */
  precision: string;
  /** Décision déjà prise (onglets Acceptées et Rejetées). */
  decided: { text: string; justification: string | null } | null;
}

const MINUTE = 60_000;

/**
 * Écran « Alertes IA » : liste par onglet, raisonnement de l'agent, décision du soignant.
 * Une décision n'enregistre que le retour humain : elle ne modifie jamais le dossier.
 */
export class AlertsViewModel {
  state: LoadState = 'idle';
  tab: AlertTab = 'ouvertes';
  items: AlertItem[] = [];
  selectedId: string | null = null;
  detail: AlertDetailData | null = null;
  justification = '';
  /** Clé de libellé de l'erreur de décision à afficher, le cas échéant. */
  decisionError: string | null = null;
  submitting = false;
  private readonly patients = new Map<string, PatientSummary | null>();

  constructor(
    private readonly gateway: PatientsGateway,
    private readonly i18n: LocaleSource,
    private readonly now: () => Date = () => new Date(),
  ) {
    makeAutoObservable<AlertsViewModel, 'gateway' | 'i18n' | 'now'>(
      this,
      { gateway: false, i18n: false, now: false },
      { autoBind: true },
    );
  }

  async load(): Promise<void> {
    this.state = 'loading';
    try {
      const items = await this.gateway.alerts();
      runInAction(() => {
        this.items = items;
        this.state = 'ready';
      });
      await this.loadPatients(items);
      await this.selectFirstOf(this.tab);
    } catch {
      runInAction(() => {
        this.state = 'error';
      });
    }
  }

  get errorMessage(): string | null {
    return this.state === 'error' ? this.i18n.t('error.generic') : null;
  }

  get openCount(): number {
    return this.items.filter((item) => item.decision.status === 'pending').length;
  }

  /** Libellé d'un onglet (l'onglet « Ouvertes » porte le nombre d'alertes ouvertes). */
  tabLabel(tab: AlertTab): string {
    if (tab === 'ouvertes') return this.i18n.t('alerts.tab.open', { count: this.openCount });
    return this.i18n.t(tab === 'acceptees' ? 'alerts.tab.accepted' : 'alerts.tab.rejected');
  }

  async selectTab(tab: AlertTab): Promise<void> {
    this.tab = tab;
    await this.selectFirstOf(tab);
  }

  /** Alertes de l'onglet courant. */
  get visible(): AlertItem[] {
    return this.items.filter((item) => TAB_STATUSES[this.tab].includes(item.decision.status));
  }

  get rows(): AlertRow[] {
    const { t } = this.i18n;
    return this.visible.map((item) => ({
      id: item.id,
      severity: item.severity,
      agent: item.agent,
      agentLabel: t(`alerts.agent.${item.agent}`),
      title: item.title,
      patientName: this.patientName(item.patientId),
      age: this.ageOf(item.raisedAt),
      selected: item.id === this.selectedId,
    }));
  }

  async select(id: string): Promise<void> {
    this.selectedId = id;
    this.justification = '';
    this.decisionError = null;
    try {
      const detail = await this.gateway.alert(id);
      runInAction(() => {
        if (this.selectedId === id) this.detail = detail;
      });
    } catch {
      runInAction(() => {
        this.state = 'error';
      });
    }
  }

  setJustification(text: string): void {
    this.justification = text;
    if (text.trim() !== '') this.decisionError = null;
  }

  /** Vrai tant que l'alerte sélectionnée attend une décision. */
  get canDecide(): boolean {
    return this.detail?.decision.status === 'pending' && !this.submitting;
  }

  /** Enregistre la décision ; un rejet sans justification est refusé avant tout envoi. */
  async decide(decision: AlertDecisionKind): Promise<void> {
    if (!this.detail || !this.canDecide) return;
    const justification = this.justification.trim();
    if (decision === 'rejeter' && justification === '') {
      this.decisionError = 'alerts.error.justification';
      return;
    }
    this.submitting = true;
    this.decisionError = null;
    const { id } = this.detail;
    try {
      const updated = await this.gateway.decideAlert(id, decision, justification === '' ? undefined : justification);
      runInAction(() => {
        this.items = this.items.map((item) => (item.id === id ? stripPrecision(updated) : item));
        this.justification = '';
        this.submitting = false;
      });
      await this.selectFirstOf(this.tab);
    } catch (error) {
      runInAction(() => {
        this.submitting = false;
        this.decisionError = error instanceof GatewayError && error.status === 409 ? 'alerts.error.conflict' : 'error.generic';
      });
    }
  }

  get decisionErrorMessage(): string | null {
    return this.decisionError === null ? null : this.i18n.t(this.decisionError);
  }

  get detailView(): AlertDetailView | null {
    const alert = this.detail;
    if (!alert) return null;
    const { t, locale } = this.i18n;
    const patient = this.patients.get(alert.patientId);
    const { precision } = alert;
    return {
      id: alert.id,
      patientId: alert.patientId,
      severity: alert.severity,
      severityLabel: t(`alerts.severity.${alert.severity}`),
      agentLabel: t(`alerts.agentFull.${alert.agent}`),
      raisedLabel: t('alerts.raisedAt', { date: formatDateTime(alert.raisedAt, locale) }),
      title: alert.title,
      patientCard: patient
        ? {
            name: `${patient.givenName} ${patient.familyName}`,
            age: t('alerts.patient.age', { age: this.ageInYears(patient.birthDate) }),
            ipp: t('alerts.patient.ipp', { ipp: patient.ipp }),
          }
        : null,
      steps: alert.reasoning.map(({ step, text }) => ({ step, title: text })),
      sources: alert.sources.map((source, index) => ({
        n: index + 1,
        label: source.document.display ?? source.document.reference,
        excerpt: source.excerpt,
      })),
      proposal: alert.proposal,
      precision:
        precision.rate === null
          ? t('alerts.precision.none')
          : t('alerts.precision', {
              percent: Math.round(precision.rate * 100),
              accepted: precision.accepted,
              decided: precision.decided,
            }),
      decided: this.decidedView(alert),
    };
  }

  private decidedView(alert: AlertDetailData): AlertDetailView['decided'] {
    const { status, decidedAt, justification } = alert.decision;
    if (status === 'pending' || decidedAt === undefined) return null;
    const { t, locale } = this.i18n;
    return {
      text: t(`alerts.decided.${status}`, { date: formatDateTime(decidedAt, locale) }),
      justification: justification === undefined ? null : t('alerts.decided.justification', { text: justification }),
    };
  }

  private patientName(patientId: string): string {
    const patient = this.patients.get(patientId);
    return patient ? `${patient.givenName} ${patient.familyName}` : this.i18n.t('alerts.patient.unknown');
  }

  private ageInYears(birthDate: string): number {
    const born = new Date(birthDate);
    const today = this.now();
    let years = today.getUTCFullYear() - born.getUTCFullYear();
    const beforeBirthday =
      today.getUTCMonth() < born.getUTCMonth() ||
      (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() < born.getUTCDate());
    if (beforeBirthday) years -= 1;
    return years;
  }

  private ageOf(raisedAt: string): string {
    const { t } = this.i18n;
    const minutes = Math.max(0, Math.floor((this.now().getTime() - Date.parse(raisedAt)) / MINUTE));
    if (minutes < 1) return t('alerts.age.now');
    if (minutes < 60) return t('alerts.age.minutes', { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('alerts.age.hours', { n: hours });
    const days = Math.floor(hours / 24);
    return days === 1 ? t('alerts.age.yesterday') : t('alerts.age.days', { n: days });
  }

  private async loadPatients(items: AlertItem[]): Promise<void> {
    const ids = [...new Set(items.map((item) => item.patientId))].filter((id) => !this.patients.has(id));
    const found = await Promise.all(
      ids.map((id) =>
        this.gateway.patient(id).then(
          (patient) => [id, patient] as const,
          () => [id, null] as const,
        ),
      ),
    );
    runInAction(() => {
      found.forEach(([id, patient]) => this.patients.set(id, patient));
    });
  }

  private async selectFirstOf(tab: AlertTab): Promise<void> {
    const first = this.items.find((item) => TAB_STATUSES[tab].includes(item.decision.status));
    if (first) {
      await this.select(first.id);
    } else {
      runInAction(() => {
        this.selectedId = null;
        this.detail = null;
      });
    }
  }
}

/** Retire la précision (propre à l'agent) pour ne garder que l'alerte dans la liste. */
function stripPrecision(detail: AlertDetailData): AlertItem {
  const item: Partial<AlertDetailData> = { ...detail };
  delete item.precision;
  return item as AlertItem;
}
