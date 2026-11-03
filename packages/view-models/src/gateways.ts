import type { Locale } from '@hygia/i18n';
import type {
  ChosenFile,
  CopiloteAnswer,
  DashboardData,
  IngestionResult,
  PatientSummary,
  Resume,
  TimelineEntry,
} from './types.js';

/** Accès aux dossiers patients (service Dossiers et résumé IA, via le broker). */
export interface PatientsGateway {
  /** Données du tableau de bord. */
  dashboard(): Promise<DashboardData>;
  /** Fiche d'un patient. */
  patient(patientId: string): Promise<PatientSummary>;
  /** Chronologie, du plus récent au plus ancien. */
  timeline(patientId: string): Promise<TimelineEntry[]>;
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
