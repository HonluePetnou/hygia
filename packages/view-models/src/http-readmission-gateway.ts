import { HttpClient } from './http-client.js';
import type { ReadmissionGateway } from './readmission-gateway.js';
import type { ReadmissionEstimate, ReadmissionFactors } from './readmission-types.js';
import type { Identity } from './types.js';

/** Passerelle HTTP : `POST /readmission` du service Agents. */
export class HttpReadmissionGateway implements ReadmissionGateway {
  private readonly client: HttpClient;

  constructor(agentsUrl: string, identity: () => Identity, fetchFn?: typeof fetch) {
    this.client = new HttpClient(agentsUrl, identity, fetchFn);
  }

  estimate(patientId: string, factors: ReadmissionFactors): Promise<ReadmissionEstimate> {
    return this.client.post('/readmission', { patientId, facteurs: factors });
  }
}
