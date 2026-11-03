import type { ConflictChoice, SyncRequest, SyncResponse, SyncTransport } from './sync-protocol.js';

/** Fonction de requête (`fetch`), injectable pour les tests. */
export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** Transport HTTP vers le service Synchronisation, par le broker (`<broker>/api/synchronisation`). */
export class HttpSyncTransport implements SyncTransport {
  constructor(
    private readonly baseUrl: string,
    private readonly token: () => string | undefined,
    private readonly fetcher: Fetcher = (url, init) => fetch(url, init),
  ) {}

  push(request: SyncRequest): Promise<SyncResponse> {
    return this.post<SyncResponse>('/sync', request);
  }

  async arbitrate(conflictId: string, choice: ConflictChoice, value?: unknown): Promise<void> {
    await this.post(`/sync/conflits/${encodeURIComponent(conflictId)}/arbitrage`, { choice, value });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const token = this.token();
    const response = await this.fetcher(`${this.baseUrl.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Synchronisation : HTTP ${response.status}`);
    return (await response.json()) as T;
  }
}
