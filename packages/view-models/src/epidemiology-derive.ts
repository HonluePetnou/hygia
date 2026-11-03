import { cityOfDistrict } from './cameroon-geography.js';
import type { EpidemiologyGateway } from './epidemiology-gateway.js';
import { shiftWeek } from './iso-week.js';
import type { BubbleLevel, CaseRow, DistrictRank, Outbreak } from './epidemiology-types.js';

/** Hausse à surveiller : au moins 3 cas et +50 % par rapport à la semaine précédente. */
export const RISE_RATIO = 1.5;
const MIN_RISE_CASES = 3;

/** Bulle de la carte : un district positionné, avec son niveau d'alerte. */
export interface Bubble {
  district: string;
  region: string;
  lon: number;
  lat: number;
  cases: number;
  level: BubbleLevel;
}

/** Niveau d'un district : foyer anormal (détecté par le service), hausse sur une semaine, ou attendu. */
export function levelOf(
  row: CaseRow,
  previousCases: number,
  outbreaks: readonly Outbreak[],
): BubbleLevel {
  if (outbreaks.some((o) => o.pathology === row.pathology && o.district === row.district)) return 'outbreak';
  if (row.cases >= MIN_RISE_CASES && row.cases >= previousCases * RISE_RATIO) return 'rise';
  return 'expected';
}

/** Bulles des districts connus de la carte, filtrées par région (`'all'` : tout le pays). */
export function buildBubbles(
  rows: readonly CaseRow[],
  previous: readonly CaseRow[],
  outbreaks: readonly Outbreak[],
  region: string,
): Bubble[] {
  const bubbles: Bubble[] = [];
  for (const row of rows) {
    const city = cityOfDistrict(row.district);
    if (!city || (region !== 'all' && city.region !== region)) continue;
    const before = previous.find((p) => p.district === row.district)?.cases ?? 0;
    bubbles.push({
      district: row.district,
      region: city.region,
      lon: city.lon,
      lat: city.lat,
      cases: row.cases,
      level: levelOf(row, before, outbreaks),
    });
  }
  return bubbles;
}

/** Agrégats d'une semaine, lus en parallèle. */
export async function fetchSnapshot(gateway: EpidemiologyGateway, pathology: string, week?: string) {
  const before = week === undefined ? undefined : shiftWeek(week, -1);
  const [now, previous, outbreaks, ranking] = await Promise.all([
    gateway.cases(pathology, week),
    gateway.cases(pathology, before),
    gateway.outbreaks(week),
    gateway.districts(pathology, week, 50),
  ]);
  return { now, previous: previous.rows, outbreaks, ranking };
}

/** Garde les districts de la région choisie (les districts inconnus de la carte n'appartiennent à aucune région). */
export function inRegion(ranking: readonly DistrictRank[], region: string): DistrictRank[] {
  if (region === 'all') return [...ranking];
  return ranking.filter((rank) => cityOfDistrict(rank.district)?.region === region);
}
