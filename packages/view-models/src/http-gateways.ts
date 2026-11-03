import type { SearchResponse } from '@hygia/fhir';
import type { Locale } from '@hygia/i18n';
import type { AlertDecisionKind, AlertDetailData, AlertItem, AlertTab } from './alert-types.js';
import type { CopiloteGateway, IngestionGateway, PatientsGateway } from './gateways.js';
import { GatewayError, HttpClient, authHeaders } from './http-client.js';
import { readSse } from './sse-reader.js';
import type {
  BreakGlassGrant,
  BreakGlassRequest,
  ChosenFile,
  CopiloteAnswer,
  DashboardData,
  DuplicateCandidate,
  Identity,
  MergeOutcome,
  MergeRequest,
  IngestionResult,
  PatientOverview,
  PatientSummary,
  RecordSearchRequest,
  Resume,
  ResourceVersion,
  TimelineEntry,
  WordHandler,
} from './types.js';

/** URLs de base des services (en production : celle du broker pour les trois). */
export interface PatientsUrls {
  dossiersUrl: string;
  iaCliniqueUrl: string;
  /** Service Identité, qui ouvre les accès d'urgence ; sans lui, le bris de glace n'est pas possible. */
  identiteUrl: string;
}

/** Réponse de `POST /bris-de-glace` du service Identité. */
interface EmergencyGrant {
  patientId: string;
  expiresAt: string;
  accessToken: string;
}

/** Passerelle HTTP vers les dossiers (`/patients`, `/tableau-de-bord`, `/patients/:id/synthese` ; les deux derniers sont à fournir par le broker) et le résumé IA. */
export class HttpPatientsGateway implements PatientsGateway {
  private readonly dossiers: HttpClient;
  private readonly ia: HttpClient;
  private readonly identite: HttpClient;

  /**
   * @param onToken Appelé avec le nouveau jeton (portant l'accès d'urgence) après un bris de glace.
   */
  constructor(
    urls: PatientsUrls,
    identity: () => Identity,
    fetchFn?: typeof fetch,
    private readonly onToken: (token: string) => void = () => undefined,
  ) {
    this.dossiers = new HttpClient(urls.dossiersUrl, identity, fetchFn);
    this.ia = new HttpClient(urls.iaCliniqueUrl, identity, fetchFn);
    this.identite = new HttpClient(urls.identiteUrl, identity, fetchFn);
  }

  dashboard(): Promise<DashboardData> {
    return this.dossiers.get('/tableau-de-bord');
  }

  search(query: string): Promise<PatientSummary[]> {
    return this.dossiers.get(`/patients?q=${encodeURIComponent(query)}`);
  }

  searchRecords(request: RecordSearchRequest): Promise<SearchResponse> {
    return this.dossiers.post('/recherche', request);
  }

  exportDossier(patientId: string, locale: Locale, summary?: string[]): Promise<Blob> {
    const body = { langue: locale, ...(summary === undefined ? {} : { resume: summary }) };
    return this.dossiers.postBlob(`/patients/${encodeURIComponent(patientId)}/export.pdf`, body);
  }

  exportSearch(request: RecordSearchRequest, locale: Locale): Promise<Blob> {
    return this.dossiers.postBlob('/recherche/export.csv', { ...request, langue: locale });
  }

  overview(patientId: string): Promise<PatientOverview> {
    return this.dossiers.get(`/patients/${encodeURIComponent(patientId)}/synthese`);
  }

  /**
   * Le service Identité ouvre l'accès de 4 h (et notifie la DPO) et renvoie un jeton qui le porte ;
   * le service Dossiers en trace ensuite le motif dans l'audit, avec ce nouveau jeton.
   */
  async openBreakGlass(patientId: string, request: BreakGlassRequest): Promise<BreakGlassGrant> {
    const grant = await this.identite.post<EmergencyGrant>('/bris-de-glace', { patientId, ...request });
    this.onToken(grant.accessToken);
    return this.dossiers.post(`/patients/${encodeURIComponent(patientId)}/bris-de-glace`, request);
  }

  patient(patientId: string): Promise<PatientSummary> {
    return this.dossiers.get(`/patients/${encodeURIComponent(patientId)}`);
  }

  timeline(patientId: string): Promise<TimelineEntry[]> {
    return this.dossiers.get(`/patients/${encodeURIComponent(patientId)}/chronologie`);
  }

  versions(patientId: string): Promise<ResourceVersion[]> {
    return this.dossiers.get(`/patients/${encodeURIComponent(patientId)}/versions`);
  }

  summary(patientId: string, locale: Locale): Promise<Resume> {
    return this.ia.get(`/patients/${encodeURIComponent(patientId)}/resume?lang=${locale}`);
  }

  duplicates(): Promise<DuplicateCandidate[]> {
    return this.dossiers.get('/doublons');
  }

  async ignoreDuplicate(duplicateId: string): Promise<void> {
    await this.dossiers.post(`/doublons/${encodeURIComponent(duplicateId)}/ignorer`, {});
  }

  mergePatients(keptId: string, mergedId: string, request: MergeRequest): Promise<MergeOutcome> {
    return this.dossiers.post(
      `/patients/${encodeURIComponent(keptId)}/fusion/${encodeURIComponent(mergedId)}`,
      request,
    );
  }

  undoMerge(mergeId: string): Promise<MergeOutcome> {
    return this.dossiers.post(`/fusions/${encodeURIComponent(mergeId)}/annuler`, {});
  }

  alerts(tab?: AlertTab): Promise<AlertItem[]> {
    return this.dossiers.get(tab === undefined ? '/alertes' : `/alertes?statut=${tab}`);
  }

  alert(alertId: string): Promise<AlertDetailData> {
    return this.dossiers.get(`/alertes/${encodeURIComponent(alertId)}`);
  }

  decideAlert(alertId: string, decision: AlertDecisionKind, justification?: string): Promise<AlertDetailData> {
    return this.dossiers.post(`/alertes/${encodeURIComponent(alertId)}/decision`, {
      decision,
      ...(justification === undefined ? {} : { justification }),
    });
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
    const path = `/copilote/${encodeURIComponent(patientId)}/flux?q=${encodeURIComponent(question)}`;
    const response = await this.fetchFn(`${this.baseUrl.replace(/\/+$/, '')}${path}`, {
      headers: { ...authHeaders(this.identity()), accept: 'text/event-stream' },
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
