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

/** Client JSON minimal : ajoute les en-têtes d'identité à chaque requête. */
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

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const { userId, role } = this.identity();
    const headers: Record<string, string> = { 'x-user-id': userId, 'x-user-role': role };
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
