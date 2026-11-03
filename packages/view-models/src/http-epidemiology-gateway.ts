import type { DelegationNotice, EpidemiologyGateway } from './epidemiology-gateway.js';
import type {
  CasesResponse,
  DistrictRank,
  LiveCase,
  LiveHandlers,
  Outbreak,
  SeriesPoint,
} from './epidemiology-types.js';
import { GatewayError, HttpClient, authHeaders } from './http-client.js';
import { readSse } from './sse-reader.js';
import type { Identity } from './types.js';

/** Chaîne de requête sans les paramètres absents. */
function query(params: Record<string, string | undefined>): string {
  const pairs = Object.entries(params).filter((pair): pair is [string, string] => pair[1] !== undefined);
  return pairs.length === 0 ? '' : `?${pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

/** Passerelle HTTP vers le service Agents (`/analyse/*`, réservé au rôle `analyste`). */
export class HttpEpidemiologyGateway implements EpidemiologyGateway {
  private readonly client: HttpClient;

  constructor(
    private readonly baseUrl: string,
    private readonly identity: () => Identity,
    private readonly fetchFn: typeof fetch = (input, init) => fetch(input, init),
  ) {
    this.client = new HttpClient(baseUrl, identity, fetchFn);
  }

  cases(pathology: string, week?: string): Promise<CasesResponse> {
    return this.client.get(`/analyse/cas${query({ pathologie: pathology, semaine: week })}`);
  }

  async series(pathology: string, district: string, week?: string): Promise<SeriesPoint[]> {
    const body = await this.client.get<{ series: SeriesPoint[] }>(
      `/analyse/serie${query({ pathologie: pathology, district, semaine: week })}`,
    );
    return body.series;
  }

  async districts(pathology: string, week?: string, limit = 5): Promise<DistrictRank[]> {
    const body = await this.client.get<{ districts: DistrictRank[] }>(
      `/analyse/districts${query({ pathologie: pathology, semaine: week, limite: String(limit) })}`,
    );
    return body.districts;
  }

  async outbreaks(week?: string): Promise<Outbreak[]> {
    const body = await this.client.get<{ outbreaks: Outbreak[] }>(`/analyse/foyers${query({ semaine: week })}`);
    return body.outbreaks;
  }

  /** Flux SSE `GET /analyse/flux` : un évènement `cas` par nouveau cas pseudonymisé. */
  subscribe(handlers: LiveHandlers): () => void {
    const controller = new AbortController();
    const path = '/analyse/flux';
    void (async () => {
      try {
        const response = await this.fetchFn(`${this.baseUrl.replace(/\/+$/, '')}${path}`, {
          headers: { ...authHeaders(this.identity()), accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!response.ok || response.body === null) throw new GatewayError(response.status, `GET ${path}`);
        handlers.onStatus('live');
        await readSse(response.body, ({ event, data }) => {
          if (event === 'cas') handlers.onCase(data as LiveCase);
        });
      } catch {
        // Fermeture volontaire ou coupure : dans les deux cas le flux n'est plus en direct.
      }
      if (!controller.signal.aborted) handlers.onStatus('offline');
    })();
    return () => controller.abort();
  }

  /** Publie `epidemie.notification` sur le bus du service Agents (`POST /events`). */
  async notifyDelegation(notice: DelegationNotice): Promise<void> {
    await this.client.post('/events', { type: 'epidemie.notification', payload: { ...notice } });
  }
}
