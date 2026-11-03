import type { Locale } from '@hygia/i18n';
import type { CopiloteGateway, IngestionGateway, PatientsGateway } from './gateways.js';
import { GatewayError, HttpClient } from './http-client.js';
import { readSse } from './sse-reader.js';
import type {
  BreakGlassGrant,
  BreakGlassRequest,
  ChosenFile,
  CopiloteAnswer,
  DashboardData,
  Identity,
  IngestionResult,
  PatientOverview,
  PatientSummary,
  Resume,
  TimelineEntry,
  WordHandler,
} from './types.js';

/** URLs de base des services (en production : celle du broker pour les trois). */
export interface PatientsUrls {
  dossiersUrl: string;
  iaCliniqueUrl: string;
}

/** Passerelle HTTP vers les dossiers (`/patients`, `/tableau-de-bord`, `/patients/:id/synthese` ; les deux derniers sont à fournir par le broker) et le résumé IA. */
export class HttpPatientsGateway implements PatientsGateway {
  private readonly dossiers: HttpClient;
  private readonly ia: HttpClient;

  constructor(urls: PatientsUrls, identity: () => Identity, fetchFn?: typeof fetch) {
    this.dossiers = new HttpClient(urls.dossiersUrl, identity, fetchFn);
    this.ia = new HttpClient(urls.iaCliniqueUrl, identity, fetchFn);
  }

  dashboard(): Promise<DashboardData> {
    return this.dossiers.get('/tableau-de-bord');
  }

  search(query: string): Promise<PatientSummary[]> {
    return this.dossiers.get(`/patients?q=${encodeURIComponent(query)}`);
  }

  overview(patientId: string): Promise<PatientOverview> {
    return this.dossiers.get(`/patients/${encodeURIComponent(patientId)}/synthese`);
  }

  openBreakGlass(patientId: string, request: BreakGlassRequest): Promise<BreakGlassGrant> {
    return this.dossiers.post(`/patients/${encodeURIComponent(patientId)}/bris-de-glace`, request);
  }

  patient(patientId: string): Promise<PatientSummary> {
    return this.dossiers.get(`/patients/${encodeURIComponent(patientId)}`);
  }

  timeline(patientId: string): Promise<TimelineEntry[]> {
    return this.dossiers.get(`/patients/${encodeURIComponent(patientId)}/chronologie`);
  }

  summary(patientId: string, locale: Locale): Promise<Resume> {
    return this.ia.get(`/patients/${encodeURIComponent(patientId)}/resume?lang=${locale}`);
  }
}

/** Passerelle HTTP vers le copilote (`POST /copilote/:patientId`). */
export class HttpCopiloteGateway implements CopiloteGateway {
  private readonly client: HttpClient;

  constructor(
    private readonly baseUrl: string,
    private readonly identity: () => Identity,
    private readonly fetchFn: typeof fetch = (input, init) => fetch(input, init),
  ) {
    this.client = new HttpClient(baseUrl, identity, fetchFn);
  }

  /** Flux SSE `GET /copilote/:patientId/flux?q=…` : évènements `word`, `sources`, `done`. */
  async stream(patientId: string, question: string, onWord: WordHandler): Promise<CopiloteAnswer> {
    const { userId, role } = this.identity();
    const path = `/copilote/${encodeURIComponent(patientId)}/flux?q=${encodeURIComponent(question)}`;
    const response = await this.fetchFn(`${this.baseUrl.replace(/\/+$/, '')}${path}`, {
      headers: { 'x-user-id': userId, 'x-user-role': role, accept: 'text/event-stream' },
    });
    if (!response.ok || response.body === null) {
      throw new GatewayError(response.status, `GET ${path}`);
    }
    const words: string[] = [];
    let language: Locale = 'fr';
    let sources: CopiloteAnswer['sources'] = [];
    await readSse(response.body, ({ event, data }) => {
      if (event === 'word') {
        const { word } = data as { word: string };
        words.push(word);
        onWord(word);
      } else if (event === 'sources') {
        ({ language, sources } = data as Pick<CopiloteAnswer, 'language' | 'sources'>);
      }
    });
    return { answer: words.join(' '), language, sources };
  }

  ask(patientId: string, question: string): Promise<CopiloteAnswer> {
    return this.client.post(`/copilote/${encodeURIComponent(patientId)}`, { question });
  }
}

/** Passerelle HTTP vers l'ingestion (`POST /ingestions`). */
export class HttpIngestionGateway implements IngestionGateway {
  private readonly client: HttpClient;

  constructor(baseUrl: string, identity: () => Identity, fetchFn?: typeof fetch) {
    this.client = new HttpClient(baseUrl, identity, fetchFn);
  }

  ingest(file: ChosenFile, patientId?: string): Promise<IngestionResult> {
    return this.client.post('/ingestions', { fileName: file.name, size: file.size, patientId });
  }
}
