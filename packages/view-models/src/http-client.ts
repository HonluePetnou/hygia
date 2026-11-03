import type { Identity } from './types.js';

/** Erreur HTTP renvoyée par le broker. */
export class GatewayError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

/** En-tête `Authorization: Bearer` de l'identité courante (vide sans jeton). */
export function authHeaders(identity: Identity): Record<string, string> {
  return identity.token === undefined ? {} : { authorization: `Bearer ${identity.token}` };
}

/** Client JSON minimal : joint le jeton d'accès à chaque requête. */
export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly identity: () => Identity,
    private readonly fetchFn: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  /** GET JSON. */
  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  /** POST JSON. */
  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  /** POST JSON, réponse binaire (export PDF ou CSV). */
  async postBlob(path: string, body: unknown): Promise<Blob> {
    const response = await this.fetchFn(`${this.baseUrl.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: { ...authHeaders(this.identity()), 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new GatewayError(response.status, `POST ${path}`);
    return response.blob();
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = authHeaders(this.identity());
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await this.fetchFn(`${this.baseUrl.replace(/\/+$/, '')}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new GatewayError(response.status, `${method} ${path}`);
    return (await response.json()) as T;
  }
}
