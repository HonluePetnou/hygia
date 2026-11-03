import { makeAutoObservable, runInAction } from 'mobx';
import { buildBubbles, fetchSnapshot, inRegion, type Bubble } from './epidemiology-derive.js';
import type { EpidemiologyGateway } from './epidemiology-gateway.js';
import {
  EPIDEMIOLOGY_PATHOLOGIES,
  type CaseRow,
  type DistrictRank,
  type LiveCase,
  type LiveStatus,
  type Outbreak,
  type SeriesPoint,
} from './epidemiology-types.js';
import { GatewayError } from './http-client.js';
import { shiftWeek, weekNumber } from './iso-week.js';
import type { LoadState } from './load-state.js';

/** Périodes proposées : semaine en cours puis jusqu'à 3 semaines en arrière. */
export const EPIDEMIOLOGY_PERIODS = [0, 1, 2, 3] as const;
/** Taille de la liste « districts les plus touchés ». */
const TOP_DISTRICTS = 5;

/** Écran « Veille épidémiologique » (maquette 08) : filtres, carte, foyer, courbe, classement, flux direct. */
export class EpidemiologyViewModel {
  state: LoadState = 'idle';
  pathology: string = EPIDEMIOLOGY_PATHOLOGIES[0];
  /** Nombre de semaines avant la dernière semaine connue. */
  period = 0;
  /** `'all'` ou clé de région. */
  region = 'all';
  week: string | null = null;
  liveStatus: LiveStatus = 'connecting';
  /** Cas reçus en direct depuis l'ouverture de l'écran. */
  liveCount = 0;
  hovered: string | null = null;
  rows: CaseRow[] = [];
  outbreaks: Outbreak[] = [];
  ranking: DistrictRank[] = [];
  series: SeriesPoint[] = [];
  /** Vrai une fois la délégation notifiée pour le foyer affiché. */
  notified = false;
  notifyFailed = false;

  private previous: CaseRow[] = [];
  private latestWeek: string | null = null;
  private token = 0;
  private reloading = false;
  private again = false;
  private stop: (() => void) | null = null;

  constructor(private readonly gateway: EpidemiologyGateway) {
    makeAutoObservable<EpidemiologyViewModel, 'gateway' | 'previous' | 'latestWeek' | 'token' | 'reloading' | 'again' | 'stop'>(
      this,
      { gateway: false, previous: false, latestWeek: false, token: false, reloading: false, again: false, stop: false },
      { autoBind: true },
    );
  }

  get bubbles(): Bubble[] {
    return buildBubbles(this.rows, this.previous, this.outbreaks, this.region);
  }

  get totalCases(): number {
    return this.bubbles.reduce((sum, bubble) => sum + bubble.cases, 0);
  }

  get regionCount(): number {
    return new Set(this.bubbles.filter((bubble) => bubble.cases > 0).map((bubble) => bubble.region)).size;
  }

  get weekNumber(): number | null {
    return this.week === null ? null : weekNumber(this.week);
  }

  /** Foyer le plus important de la pathologie et de la région affichées. */
  get focus(): Outbreak | null {
    const shown = new Set(this.bubbles.map((bubble) => bubble.district));
    const found = this.outbreaks.filter((o) => o.pathology === this.pathology && shown.has(o.district));
    return found.sort((a, b) => b.cases - a.cases)[0] ?? null;
  }

  /** Classement affiché : région choisie, 5 premiers. */
  get topDistricts(): DistrictRank[] {
    return inRegion(this.ranking, this.region).slice(0, TOP_DISTRICTS);
  }

  /** District dont la courbe est tracée : le foyer, sinon le plus touché. */
  get chartDistrict(): string | null {
    return this.focus?.district ?? this.topDistricts[0]?.district ?? null;
  }

  get hoveredBubble(): Bubble | null {
    return this.bubbles.find((bubble) => bubble.district === this.hovered) ?? null;
  }

  /** Premier chargement, puis ouverture du flux temps réel. */
  async load(): Promise<void> {
    this.stop ??= this.gateway.subscribe({
      onCase: (item) => this.receive(item),
      onStatus: (status) => runInAction(() => (this.liveStatus = status)),
    });
    await this.reload();
  }

  /** Ferme le flux temps réel. */
  dispose(): void {
    this.stop?.();
    this.stop = null;
  }

  setPathology(pathology: string): Promise<void> {
    this.pathology = pathology;
    this.notified = false;
    return this.reload();
  }

  setPeriod(period: number): Promise<void> {
    this.period = period;
    this.notified = false;
    return this.reload();
  }

  /** Le filtre région ne demande rien au service : il restreint ce qui est déjà chargé. */
  async setRegion(region: string): Promise<void> {
    this.region = region;
    this.notified = false;
    await this.loadSeries(this.token);
  }

  setHovered(district: string | null): void {
    this.hovered = district;
  }

  /** Publie la notification de la délégation pour le foyer affiché. */
  async notifyDelegation(): Promise<void> {
    const focus = this.focus;
    if (focus === null || this.week === null) return;
    try {
      await this.gateway.notifyDelegation({
        pathology: focus.pathology,
        district: focus.district,
        week: this.week,
        cases: focus.cases,
        threshold: focus.threshold,
      });
      runInAction(() => {
        this.notified = true;
        this.notifyFailed = false;
      });
    } catch {
      runInAction(() => (this.notifyFailed = true));
    }
  }

  /** Un cas arrive : compté et affiché sans attendre, en relisant les agrégats (une relecture à la fois). */
  private receive(item: LiveCase): void {
    this.liveCount += 1;
    if (item.pathology !== this.pathology) return;
    if (this.period === 0 && (this.latestWeek === null || item.week > this.latestWeek)) this.latestWeek = item.week;
    if (this.reloading) this.again = true;
    else void this.reload();
  }

  private async reload(): Promise<void> {
    this.reloading = true;
    const token = ++this.token;
    if (this.rows.length === 0) this.state = 'loading';
    try {
      this.latestWeek ??= (await this.gateway.cases(this.pathology)).week;
      const week = this.latestWeek === null ? undefined : shiftWeek(this.latestWeek, -this.period);
      const snapshot = await fetchSnapshot(this.gateway, this.pathology, week);
      if (token !== this.token) return;
      runInAction(() => {
        this.week = snapshot.now.week;
        this.rows = snapshot.now.rows;
        this.previous = snapshot.previous;
        this.outbreaks = snapshot.outbreaks;
        this.ranking = snapshot.ranking;
      });
      await this.loadSeries(token);
      runInAction(() => (this.state = 'ready'));
    } catch (error) {
      if (token === this.token) runInAction(() => (this.state = error instanceof GatewayError && error.status === 403 ? 'forbidden' : 'error'));
    } finally {
      this.reloading = false;
      if (this.again) {
        this.again = false;
        void this.reload();
      }
    }
  }

  private async loadSeries(token: number): Promise<void> {
    const district = this.chartDistrict;
    const series = district === null ? [] : await this.gateway.series(this.pathology, district, this.week ?? undefined);
    if (token === this.token) runInAction(() => (this.series = series));
  }
}
