import type { Locale } from '@hygia/i18n';
import type { CopiloteGateway, IngestionGateway, PatientsGateway } from './gateways.js';
import { HttpClient } from './http-client.js';
import type {
  ChosenFile,
  CopiloteAnswer,
  DashboardData,
  Identity,
  IngestionResult,
  PatientSummary,
  Resume,
  TimelineEntry,
} from './types.js';

/** URLs de base des services (en production : celle du broker pour les trois). */
export interface PatientsUrls {
  dossiersUrl: string;
  iaCliniqueUrl: string;
}

/** Passerelle HTTP vers les dossiers (`/patients`, `/tableau-de-bord`) et le résumé IA. */
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

  constructor(baseUrl: string, identity: () => Identity, fetchFn?: typeof fetch) {
    this.client = new HttpClient(baseUrl, identity, fetchFn);
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

  ingest(file: ChosenFile): Promise<IngestionResult> {
    return this.client.post('/ingestions', { fileName: file.name, size: file.size });
  }
}
