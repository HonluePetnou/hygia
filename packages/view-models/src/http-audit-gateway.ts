import type { AuditGateway } from './audit-gateway.js';
import type { AuditPageData, AuditSearch, AuditSummaryData } from './audit-types.js';
import { GatewayError, HttpClient, authHeaders } from './http-client.js';
import type { Identity } from './types.js';

function params(search: Partial<AuditSearch>): string {
  const pairs: [string, string][] = [];
  if (search.filter !== undefined) pairs.push(['categorie', search.filter]);
  if (search.text !== undefined && search.text !== '') pairs.push(['q', search.text]);
  if (search.page !== undefined) pairs.push(['page', String(search.page)]);
  if (search.pageSize !== undefined) pairs.push(['taille', String(search.pageSize)]);
  return pairs.length === 0 ? '' : `?${pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

/** Passerelle HTTP vers le service Audit (`/events`, `/summary`, `/export.csv`). */
export class HttpAuditGateway implements AuditGateway {
  private readonly client: HttpClient;

  constructor(
    private readonly baseUrl: string,
    private readonly identity: () => Identity,
    private readonly fetchFn: typeof fetch = (input, init) => fetch(input, init),
  ) {
    this.client = new HttpClient(baseUrl, identity, fetchFn);
  }

  search(search: AuditSearch): Promise<AuditPageData> {
    return this.client.get(`/events${params(search)}`);
  }

  summary(): Promise<AuditSummaryData> {
    return this.client.get('/summary');
  }

  async exportCsv(search: Omit<AuditSearch, 'page' | 'pageSize'>): Promise<string> {
    const path = `/export.csv${params(search)}`;
    const response = await this.fetchFn(`${this.baseUrl.replace(/\/+$/, '')}${path}`, {
      headers: authHeaders(this.identity()),
    });
    if (!response.ok) throw new GatewayError(response.status, `GET ${path}`);
    return response.text();
  }
}
