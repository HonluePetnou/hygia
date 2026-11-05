import { localParts } from '@hygia/i18n';
import { makeAutoObservable, runInAction } from 'mobx';
import { GatewayError } from './http-client.js';
import type { LoadState } from './load-state.js';
import type { SupervisionGateway } from './supervision-gateway.js';
import {
  EXPERIMENT_IDS,
  type ExperimentId,
  type ServiceHealth,
  type SupervisionData,
} from './supervision-types.js';
import type { LocaleSource } from './types.js';

/** Carte d'un service (grille de la maquette 10). */
export interface ServiceCard {
  id: string;
  name: string;
  runtime: string;
  status: ServiceHealth;
  statusLabel: string;
  p95Label: string;
  /** Un p95 > 500 ms est affiché en orange. */
  slow: boolean;
  zones: { id: string; label: string; up: boolean; title: string }[];
}

/** Bandeau d'exercice de panne. */
export interface ExerciseBanner {
  title: string;
  detail: string;
}

/** Ligne de la liste des expériences. */
export interface ExperimentRow {
  id: ExperimentId;
  label: string;
  detail: string;
  active: boolean;
  /** Une demande de lancement ou d'arrêt est en cours. */
  busy: boolean;
}

/** Courbe de latence en coordonnées SVG (`CHART_WIDTH` × `CHART_HEIGHT`). */
export interface LatencyChart {
  line: string;
  area: string;
  /** Début et fin de la zone surlignée (expérience en cours), en x SVG. */
  highlight: { x: number; width: number } | null;
}

export const CHART_WIDTH = 616;
export const CHART_HEIGHT = 150;
const SLOW_MS = 500;

/** `182 ms`, `1,4 s` (virgule en français). */
export function formatLatency(ms: number, locale: 'fr' | 'en'): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = (Math.round(ms / 100) / 10).toFixed(1);
  return `${locale === 'fr' ? seconds.replace('.', ',') : seconds} s`;
}

/** Heure d'un événement (début d'expérience), à l'heure du Cameroun. */
function clock(iso: string): string {
  const d = localParts(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.hours)}:${p(d.minutes)}`;
}

/** Écran « Supervision » (maquette 10) : services, latence p95 et expériences de pannes (admin). */
export class SupervisionViewModel {
  state: LoadState = 'idle';
  data: SupervisionData | null = null;
  busy: ExperimentId | 'exercise' | null = null;
  actionFailed = false;

  constructor(
    private readonly gateway: SupervisionGateway,
    private readonly i18n: LocaleSource,
  ) {
    makeAutoObservable<SupervisionViewModel, 'gateway' | 'i18n'>(
      this,
      { gateway: false, i18n: false },
      { autoBind: true },
    );
  }

  async load(): Promise<void> {
    this.state = 'loading';
    await this.refresh();
  }

  /** Relit l'état sans repasser par « chargement » (appelé périodiquement par l'écran). */
  async refresh(): Promise<void> {
    try {
      const data = await this.gateway.load();
      runInAction(() => this.accept(data));
    } catch (error) {
      runInAction(() => this.fail(error));
    }
  }

  /** Lance l'expérience si elle est arrêtée, l'arrête sinon. */
  async toggle(id: ExperimentId): Promise<void> {
    const active = this.data?.experiments.find((e) => e.id === id)?.active ?? false;
    await this.act(id, () => (active ? this.gateway.stop(id) : this.gateway.start(id)));
  }

  /** « Arrêter l'exercice » : retire toutes les pannes. */
  async stopExercise(): Promise<void> {
    await this.act('exercise', () => this.gateway.stopExercise());
  }

  get cards(): ServiceCard[] {
    const { t, locale } = this.i18n;
    return (this.data?.services ?? []).map((s) => ({
      id: s.id,
      name: t(`supervision.service.${s.id}`),
      runtime: t(`supervision.runtime.${s.id}`),
      status: s.status,
      statusLabel: t(`supervision.status.${s.status}`),
      p95Label: s.p95Ms === null ? t('supervision.p95.none') : t('supervision.p95', { value: formatLatency(s.p95Ms, locale) }),
      slow: s.p95Ms !== null && s.p95Ms > SLOW_MS,
      zones: s.instances.map((i) => ({
        id: i.id,
        label: t(`supervision.zone.${i.zone}`),
        up: i.up,
        title: t(i.up ? 'supervision.instance.up' : 'supervision.instance.down', { id: i.id }),
      })),
    }));
  }

  get banner(): ExerciseBanner | null {
    const exercise = this.data?.exercise;
    if (exercise === undefined || !exercise.active || exercise.headline === undefined) return null;
    const { t } = this.i18n;
    const since = this.data?.experiments.find((e) => e.id === exercise.headline)?.since ?? exercise.since ?? '';
    const detailKey = exercise.headline === 'llm-down' ? 'supervision.banner.detail.llm' : 'supervision.banner.detail';
    return {
      title: t(`supervision.banner.${exercise.headline}`, { time: clock(since) }),
      detail: t(detailKey, { errors: exercise.userErrors, failovers: exercise.failovers }),
    };
  }

  get experiments(): ExperimentRow[] {
    const { t } = this.i18n;
    return EXPERIMENT_IDS.map((id) => ({
      id,
      label: t(`supervision.experiment.${id}.label`),
      detail: t(`supervision.experiment.${id}.detail`),
      active: this.data?.experiments.find((e) => e.id === id)?.active ?? false,
      busy: this.busy === id,
    }));
  }

  get sloMet(): boolean {
    return this.data?.latency.sloMet ?? true;
  }

  get peakMs(): number {
    return Math.max(0, ...(this.data?.latency.points ?? []).map((p) => p.p95Ms));
  }

  get latencyCaption(): string {
    const { t, locale } = this.i18n;
    const points = this.data?.latency.points ?? [];
    if (points.length === 0) return t('supervision.latency.empty');
    const requests = points.reduce((sum, p) => sum + p.count, 0);
    return t('supervision.latency.caption', { peak: formatLatency(this.peakMs, locale), count: requests });
  }

  /** Courbe p95 ; l'échelle verticale couvre au moins 500 ms pour qu'un trait plat reste lisible. */
  get chart(): LatencyChart | null {
    const points = this.data?.latency.points ?? [];
    if (points.length === 0) return null;
    const top = Math.max(this.peakMs * 1.1, SLOW_MS);
    const x = (i: number) => (points.length === 1 ? CHART_WIDTH / 2 : (i / (points.length - 1)) * CHART_WIDTH);
    const y = (ms: number) => CHART_HEIGHT - (ms / top) * (CHART_HEIGHT - 10);
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.p95Ms).toFixed(1)}`).join(' ');
    const area = `${line} L${x(points.length - 1).toFixed(1)},${CHART_HEIGHT} L${x(0).toFixed(1)},${CHART_HEIGHT} Z`;
    const since = this.data?.exercise.since;
    let highlight: LatencyChart['highlight'] = null;
    if (since !== undefined) {
      const first = points.findIndex((p) => p.at >= since.slice(0, 19));
      if (first !== -1) highlight = { x: x(first), width: Math.max(8, CHART_WIDTH - x(first)) };
    }
    return { line, area, highlight };
  }

  private async act(busy: ExperimentId | 'exercise', call: () => Promise<SupervisionData>): Promise<void> {
    this.busy = busy;
    this.actionFailed = false;
    try {
      const data = await call();
      runInAction(() => this.accept(data));
    } catch (error) {
      runInAction(() => {
        this.actionFailed = true;
        this.fail(error);
      });
    } finally {
      runInAction(() => {
        this.busy = null;
      });
    }
  }

  private accept(data: SupervisionData): void {
    this.data = data;
    this.state = 'ready';
  }

  private fail(error: unknown): void {
    if (error instanceof GatewayError && error.status === 403) this.state = 'forbidden';
    // Un échec de rafraîchissement garde les dernières données affichées.
    else if (this.data === null) this.state = 'error';
  }
}
