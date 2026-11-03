import { HttpClient } from './http-client.js';
import type { SupervisionGateway } from './supervision-gateway.js';
import type { ExperimentId, SupervisionData } from './supervision-types.js';
import type { Identity } from './types.js';

/** Passerelle HTTP vers le broker : `/api/supervision` (l'URL de base inclut `/api`). */
export class HttpSupervisionGateway implements SupervisionGateway {
  private readonly client: HttpClient;

  constructor(baseUrl: string, identity: () => Identity, fetchFn?: typeof fetch) {
    this.client = new HttpClient(baseUrl, identity, fetchFn);
  }

  load(): Promise<SupervisionData> {
    return this.client.get('');
  }

  start(id: ExperimentId): Promise<SupervisionData> {
    return this.client.post(`/experiments/${id}/start`, {});
  }

  stop(id: ExperimentId): Promise<SupervisionData> {
    return this.client.post(`/experiments/${id}/stop`, {});
  }

  stopExercise(): Promise<SupervisionData> {
    return this.client.post('/exercise/stop', {});
  }
}
