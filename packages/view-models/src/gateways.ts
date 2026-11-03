import type { Locale } from '@hygia/i18n';
import type {
  AuthSession,
  LoginChallenge,
  MfaEnrollment,
  SecondFactor,
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
  WordHandler,
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
  /** Même question en flux : `onWord` reçoit chaque mot au fil de l'eau, puis la réponse complète. */
  stream(patientId: string, question: string, onWord: WordHandler): Promise<CopiloteAnswer>;
}

/** Accès à la chaîne d'ingestion. */
export interface IngestionGateway {
  /** Soumet un fichier (rattaché à un patient, facultatif) et renvoie l'état de chaque étape. */
  ingest(file: ChosenFile, patientId?: string): Promise<IngestionResult>;
}

/** Accès au service Identité (connexion en deux étapes, via le broker). */
export interface AuthGateway {
  /** Étape 1 : e-mail et mot de passe ; rejette avec `GatewayError` 401 si invalides. */
  login(email: string, password: string): Promise<LoginChallenge>;
  /** Secret et QR code pour un compte dont la double authentification n'est pas encore enrôlée. */
  enroll(challengeId: string): Promise<MfaEnrollment>;
  /** Étape 2 : code TOTP ou code de secours ; renvoie le jeton d'accès. */
  verify(challengeId: string, factor: SecondFactor): Promise<AuthSession>;
}
