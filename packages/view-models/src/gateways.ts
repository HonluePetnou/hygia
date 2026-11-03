import type { Locale } from '@hygia/i18n';
import type {
  BreakGlassGrant,
  BreakGlassRequest,
  ChosenFile,
  CopiloteAnswer,
  DashboardData,
  IngestionResult,
  PatientOverview,
  PatientSummary,
  Resume,
  TimelineEntry,
} from './types.js';

/** Accès aux dossiers patients (service Dossiers et résumé IA, via le broker). */
export interface PatientsGateway {
  /** Données du tableau de bord. */
  dashboard(): Promise<DashboardData>;
  /** Recherche par nom ou IPP (requête vide : tous les patients). */
  search(query: string): Promise<PatientSummary[]>;
  /** Fiche d'un patient ; rejette avec `GatewayError` 403 hors équipe de soins. */
  patient(patientId: string): Promise<PatientSummary>;
  /** Chronologie, du plus récent au plus ancien. */
  timeline(patientId: string): Promise<TimelineEntry[]>;
  /** Constantes, traitements et équipe de soins. */
  overview(patientId: string): Promise<PatientOverview>;
  /** Ouvre un accès d'urgence de 4 h (bris de glace, tracé dans l'audit). */
  openBreakGlass(patientId: string, request: BreakGlassRequest): Promise<BreakGlassGrant>;
  /** Résumé pré-consultation dans la langue demandée. */
  summary(patientId: string, locale: Locale): Promise<Resume>;
}

/** Accès au copilote IA. */
export interface CopiloteGateway {
  /** Pose une question ; la réponse cite ses sources. */
  ask(patientId: string, question: string): Promise<CopiloteAnswer>;
}

/** Accès à la chaîne d'ingestion. */
export interface IngestionGateway {
  /** Soumet un fichier et renvoie l'état de chaque étape. */
  ingest(file: ChosenFile): Promise<IngestionResult>;
}
