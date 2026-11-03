import type { Role } from '@hygia/types';
import type { Locale, Translate } from '@hygia/i18n';

/** Identité transmise au broker (en-têtes `x-user-id` et `x-user-role`, auth simulée). */
export interface Identity {
  userId: string;
  role: Role;
}

/** Source de langue : fournit la langue courante et la fonction de traduction associée. */
export interface LocaleSource {
  readonly locale: Locale;
  readonly t: Translate;
}

/** Types d'événements de la chronologie (même vocabulaire que le service Dossiers). */
export type TimelineEntryType = 'consultation' | 'examen' | 'prescription' | 'document' | 'alerte';

/** Événement de la chronologie d'un dossier. */
export interface TimelineEntry {
  type: TimelineEntryType;
  date: string;
  /** Ressource d'origine (`Type/uuid`). */
  resource: { reference: string };
  label: string;
}

/** Source citée à l'appui d'une réponse ou d'une ligne de résumé. */
export interface CopiloteSource {
  n: number;
  documentId: string;
  titre: string;
  date: string;
  extrait: string;
}

/** Ligne du résumé avec ses sources. */
export interface ResumeItem {
  texte: string;
  sources: CopiloteSource[];
}

/** Résumé pré-consultation généré par IA (à valider par un soignant). */
export interface Resume {
  patientId: string;
  language: Locale;
  generatedByAi: true;
  titres: { antecedents: string; traitements: string; resultats: string; alertes: string };
  antecedents: ResumeItem[];
  traitements: ResumeItem[];
  resultats: ResumeItem[];
  alertes: ResumeItem[];
}

/** Réponse du copilote. */
export interface CopiloteAnswer {
  answer: string;
  language: Locale;
  sources: CopiloteSource[];
}

/** Alerte ouverte, non traduite : la vue-modèle produit le texte selon la langue. */
export interface AlertSummary {
  id: string;
  patientId: string;
  severity: 'low' | 'moderate' | 'high';
  kind: 'allergy' | 'interaction';
  /** Paramètres d'interpolation du libellé `summary.alert.<kind>`. */
  params: Record<string, string | number>;
  raisedAt: string;
}

/** Consultation affichée sur le tableau de bord. */
export interface ConsultationSummary {
  id: string;
  patientId: string;
  patientName: string;
  start: string;
}

/** Données brutes du tableau de bord. */
export interface DashboardData {
  consultations: ConsultationSummary[];
  alerts: AlertSummary[];
  documentsImported: number;
}

/** Fiche patient minimale affichée par les clients. */
export interface PatientSummary {
  id: string;
  ipp: string;
  familyName: string;
  givenName: string;
  birthDate: string;
}

/** Étapes de la chaîne d'ingestion. */
export type IngestionStepId =
  'reception' | 'ocr' | 'normalization' | 'aiExtraction' | 'identifierDetection';

/** Statut d'une étape. */
export type IngestionStepStatus = 'pending' | 'inProgress' | 'done' | 'failed';

/** Étape de la chaîne avec statut et durée. */
export interface IngestionStep {
  id: IngestionStepId;
  status: IngestionStepStatus;
  durationMs?: number;
}

/** Résultat d'un import. */
export interface IngestionResult {
  documentId: string;
  steps: IngestionStep[];
}

/** Fichier choisi par l'utilisateur. */
export interface ChosenFile {
  name: string;
  size?: number;
}
