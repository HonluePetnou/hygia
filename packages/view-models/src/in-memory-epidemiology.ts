import type { Locale } from '@hygia/i18n';
import { CAMEROON_CITIES } from './cameroon-geography.js';
import type { DelegationNotice, EpidemiologyGateway } from './epidemiology-gateway.js';
import type {
  CaseRow,
  CasesResponse,
  DistrictRank,
  LiveCase,
  LiveHandlers,
  Outbreak,
  SeriesPoint,
} from './epidemiology-types.js';
import { shiftWeek } from './iso-week.js';

const WINDOW_WEEKS = 8;
const SERIES_WEEKS = 12;
const MIN_CASES = 3;
const YEAR = 2026;
const FOCUS = 44;

function limitOf(history: number[]): { expected: number; threshold: number } {
  const mean = history.reduce((sum, n) => sum + n, 0) / history.length;
  const variance = history.reduce((sum, n) => sum + (n - mean) ** 2, 0) / history.length;
  return { expected: mean, threshold: mean + 2 * Math.sqrt(variance) };
}

/** Arrondi à une décimale, moitié vers le pair comme `round` de Python côté service. */
function round1(n: number): number {
  const scaled = n * 10;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  const up = Math.abs(diff - 0.5) < 1e-9 ? floor % 2 !== 0 : diff > 0.5;
  return (up ? floor + 1 : floor) / 10;
}
const weekLabel = (n: number) => `${YEAR}-W${String(n).padStart(2, '0')}`;

/**
 * Passerelle en mémoire : mêmes données fictives que le service Agents (paludisme stable dans 12 villes,
 * foyer de choléra à Mora), plus une hausse de dengue à Douala et un peu de rougeole à Garoua.
 * `push` simule l'arrivée d'un cas sur le flux temps réel.
 */
export class InMemoryEpidemiologyGateway implements EpidemiologyGateway {
  /** Avis publiés à la délégation (pour les tests). */
  readonly notices: DelegationNotice[] = [];
  private readonly counts = new Map<string, number>();
  private readonly listeners = new Set<LiveHandlers>();

  constructor() {
    for (let week = FOCUS - 8; week <= FOCUS; week += 1) {
      CAMEROON_CITIES.forEach((city, i) => {
        this.set('paludisme', city.district, week, 6 + (i % 4) + ((week + i) % 3) - 1);
      });
      this.set('choléra', 'Mora', week, week < FOCUS ? [2, 0, 5, 3, 5, 1, 5, 5][week - 36] ?? 0 : 14);
      this.set('choléra', 'Maroua', week, week === FOCUS ? 9 : 1);
      this.set('dengue', 'Douala', week, week < FOCUS ? ([1, 4, 1, 4, 1, 4, 1, 2][week - 36] ?? 0) : 4);
      this.set('rougeole', 'Garoua', week, 1 + (week % 2));
    }
  }

  /** Ajoute un cas et le diffuse aux abonnés, comme le ferait le flux SSE. */
  push(item: LiveCase): void {
    const key = this.key(item.pathology, item.district, item.week);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
    this.listeners.forEach((handlers) => handlers.onCase(item));
  }

  cases(pathology: string, week?: string): Promise<CasesResponse> {
    const current = week ?? weekLabel(FOCUS);
    return Promise.resolve({ week: current, rows: this.rowsOf(pathology, current) });
  }

  series(pathology: string, district: string, week?: string): Promise<SeriesPoint[]> {
    const end = week ?? weekLabel(FOCUS);
    const points: SeriesPoint[] = [];
    for (let i = SERIES_WEEKS - 1; i >= 0; i -= 1) {
      const current = shiftWeek(end, -i);
      const cases = this.count(pathology, district, current);
      const { expected, threshold } = this.thresholdOf(pathology, district, current);
      points.push({
        week: current,
        cases,
        expected: round1(expected),
        threshold: round1(threshold),
        anomaly: cases >= MIN_CASES && cases > threshold,
      });
    }
    return Promise.resolve(points);
  }

  districts(pathology: string, week?: string, limit = 5): Promise<DistrictRank[]> {
    const current = week ?? weekLabel(FOCUS);
    const ranking = this.rowsOf(pathology, current)
      .map((row) => ({ district: row.district, cases: row.cases, outbreak: this.isOutbreak(row, current) }))
      .sort((a, b) => b.cases - a.cases || a.district.localeCompare(b.district));
    return Promise.resolve(ranking.slice(0, Math.max(limit, 0)));
  }

  outbreaks(week?: string): Promise<Outbreak[]> {
    const current = week ?? weekLabel(FOCUS);
    const found: Outbreak[] = [];
    for (const pathology of new Set([...this.counts.keys()].map((key) => key.split('|')[0] ?? ''))) {
      for (const row of this.rowsOf(pathology, current)) {
        if (!this.isOutbreak(row, current)) continue;
        const { expected, threshold } = this.thresholdOf(pathology, row.district, current);
        found.push({
          pathology,
          district: row.district,
          cases: row.cases,
          expected: round1(expected),
          threshold: round1(threshold),
        });
      }
    }
    return Promise.resolve(found);
  }

  subscribe(handlers: LiveHandlers): () => void {
    this.listeners.add(handlers);
    handlers.onStatus('live');
    return () => this.listeners.delete(handlers);
  }

  /** Hors ligne : pas de moteur PDF, le fichier contient seulement un avis. */
  exportReport(locale: Locale): Promise<Blob> {
    return Promise.resolve(new Blob([`%PDF-1.4 hors ligne ${locale}`], { type: 'application/pdf' }));
  }

  notifyDelegation(notice: DelegationNotice): Promise<void> {
    this.notices.push(notice);
    return Promise.resolve();
  }

  private key(pathology: string, district: string, week: string): string {
    return `${pathology}|${district}|${week}`;
  }

  private set(pathology: string, district: string, week: number, cases: number): void {
    this.counts.set(this.key(pathology, district, weekLabel(week)), cases);
  }

  private count(pathology: string, district: string, week: string): number {
    return this.counts.get(this.key(pathology, district, week)) ?? 0;
  }

  private rowsOf(pathology: string, week: string): CaseRow[] {
    const rows: CaseRow[] = [];
    for (const key of this.counts.keys()) {
      const [keyPathology, district, keyWeek] = key.split('|');
      if (keyPathology === pathology && keyWeek === week && district !== undefined) {
        rows.push({ pathology, district, cases: this.counts.get(key) ?? 0 });
      }
    }
    return rows.sort((a, b) => a.district.localeCompare(b.district));
  }

  private thresholdOf(pathology: string, district: string, week: string) {
    const history = Array.from({ length: WINDOW_WEEKS }, (_, i) =>
      this.count(pathology, district, shiftWeek(week, i - WINDOW_WEEKS)),
    );
    return limitOf(history);
  }

  private isOutbreak(row: CaseRow, week: string): boolean {
    return row.cases >= MIN_CASES && row.cases > this.thresholdOf(row.pathology, row.district, week).threshold;
  }
}
