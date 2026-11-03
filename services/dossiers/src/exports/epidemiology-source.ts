/** Jeton d'injection de `EpidemiologySource`. */
export const EPIDEMIOLOGY_SOURCE = Symbol('EPIDEMIOLOGY_SOURCE');

/** Agrégats pseudonymisés d'une semaine : aucune donnée identifiante. */
export interface EpidemiologyData {
  week: string | null;
  cases: Array<{ pathology: string; district: string; cases: number }>;
  districts: Array<{ district: string; cases: number; outbreak: boolean }>;
  outbreaks: Array<{ pathology: string; district: string; cases: number; expected: number; threshold: number }>;
}

/** Lecture des agrégats de la branche analytique (service Agents). */
export interface EpidemiologySource {
  /** Agrégats de la dernière semaine connue, pour une pathologie ou toutes. */
  load(pathology: string | undefined): Promise<EpidemiologyData>;
}

/** Source HTTP : appelle `/analyse/*` du service Agents au nom d'un analyste déjà authentifié. */
export class HttpEpidemiologySource implements EpidemiologySource {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  async load(pathology: string | undefined): Promise<EpidemiologyData> {
    const filter = pathology === undefined ? '' : `?pathologie=${encodeURIComponent(pathology)}`;
    const [cases, districts, outbreaks] = await Promise.all([
      this.get<{ week: string | null; rows: EpidemiologyData['cases'] }>(`cas${filter}`),
      this.get<{ districts: EpidemiologyData['districts'] }>(`districts${filter}`),
      this.get<{ outbreaks: EpidemiologyData['outbreaks'] }>('foyers'),
    ]);
    return {
      week: cases.week,
      cases: cases.rows,
      districts: districts.districts,
      outbreaks: pathology === undefined ? outbreaks.outbreaks : outbreaks.outbreaks.filter((o) => o.pathology === pathology),
    };
  }

  private async get<T>(route: string): Promise<T> {
    const response = await this.fetchFn(`${this.baseUrl.replace(/\/+$/, '')}/analyse/${route}`, {
      headers: { 'x-user-role': 'analyste' },
    });
    if (!response.ok) throw new Error(`Service Agents : ${response.status} sur /analyse/${route}`);
    return (await response.json()) as T;
  }
}
