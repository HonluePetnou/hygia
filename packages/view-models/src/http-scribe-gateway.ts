import { HttpClient } from './http-client.js';
import type { ScribeGateway } from './scribe-gateway.js';
import type { ScribeDraftData, ScribeSessionData } from './scribe-types.js';
import type { Identity } from './types.js';

/** Passerelle HTTP du scribe : service IA clinique (`/scribe/...`). */
export class HttpScribeGateway implements ScribeGateway {
  private readonly client: HttpClient;

  constructor(iaCliniqueUrl: string, identity: () => Identity, fetchFn?: typeof fetch) {
    this.client = new HttpClient(iaCliniqueUrl, identity, fetchFn);
  }

  start(patientId: string): Promise<ScribeSessionData> {
    return this.client.post(`/scribe/patients/${encodeURIComponent(patientId)}/sessions`, {});
  }

  sendAudio(
    sessionId: string,
    audioBase64: string,
    durationSeconds: number,
  ): Promise<ScribeSessionData> {
    return this.client.post(`/scribe/sessions/${encodeURIComponent(sessionId)}/audio`, {
      audioBase64,
      durationSeconds,
    });
  }

  validate(sessionId: string, draft: ScribeDraftData): Promise<ScribeSessionData> {
    return this.client.post(`/scribe/sessions/${encodeURIComponent(sessionId)}/validation`, {
      draft,
    });
  }

  reject(sessionId: string): Promise<ScribeSessionData> {
    return this.client.post(`/scribe/sessions/${encodeURIComponent(sessionId)}/rejet`, {});
  }
}
