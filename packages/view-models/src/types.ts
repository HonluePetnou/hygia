import type { Role } from '@hygia/types';
import type { Locale, Translate } from '@hygia/i18n';

/** Identité de la session : le jeton JWT est transmis au broker (`Authorization: Bearer`). */
export interface Identity {
  userId: string;
  role: Role;
  /** Jeton d'accès du service Identité ; absent en mode hors ligne (aucun appel réseau). */
  token?: string;
}

/** Première étape de connexion franchie. */
export interface LoginChallenge {
  challengeId: string;
  /** `verify` : saisir le code ; `enroll` : enrôler d'abord l'application d'authentification. */
  mfa: 'verify' | 'enroll';
}

/** Données d'enrôlement de l'application d'authentification. */
export interface MfaEnrollment {
  secret: string;
  otpauthUri: string;
  /** QR code (`data:image/png;base64,…`). */
  qrCode: string;
}

/** Session ouverte après la seconde étape. */
export interface AuthSession {
  accessToken: string;
  expiresAt: string;
  user: { id: string; email: string; displayName: string; role: Role };
  /** Codes de secours, fournis une seule fois après un enrôlement. */
  backupCodes?: string[];
}

/** Second facteur saisi : code TOTP ou code de secours. */
export type SecondFactor = { code: string } | { backupCode: string };

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
  /** Détail affiché sous le titre (absent si le service ne le fournit pas). */
  detail?: string;
  /** Auteur et lieu (absent si inconnu). */
  author?: string;
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

/** Statut d'une consultation du jour. */
export type ConsultationStatus = 'done' | 'inProgress' | 'alert' | 'upcoming';

/** Consultation affichée sur le tableau de bord. */
export interface ConsultationSummary {
  id: string;
  patientId: string;
  patientName: string;
  start: string;
  /** Motif : classe de rencontre (`ambulatory`, `inpatient`, `emergency`) ou texte libre. */
  reason: string;
  status: ConsultationStatus;
}

/** Étape de traitement d'un document en cours. */
export type DocumentStage = 'ocr' | 'extraction' | 'done';

/** Document en cours de traitement dans la chaîne d'ingestion. */
export interface DocumentInProgress {
  id: string;
  title: string;
  /** Canal d'arrivée (WhatsApp, upload web, API FHIR…). */
  source: string;
  stage: DocumentStage;
  /** Avancement de 0 à 100. */
  progress: number;
}

/** Données brutes du tableau de bord. */
export interface DashboardData {
  consultations: ConsultationSummary[];
  alerts: AlertSummary[];
  documentsImported: number;
  /** Documents en cours de traitement (chaîne tubes et filtres). */
  documentsInProgress: DocumentInProgress[];
  /** Résultats d'examens en attente de validation par un soignant. */
  resultsToValidate: number;
  /** Consultations par jour de la semaine, du lundi au dimanche. */
  weekActivity: number[];
}

/** Fiche patient minimale affichée par les clients. */
export interface PatientSummary {
  id: string;
  ipp: string;
  familyName: string;
  givenName: string;
  birthDate: string;
  gender?: 'female' | 'male' | 'other' | 'unknown';
  phone?: string;
  /** Établissement de rattachement (`display` : nom lisible, si connu). */
  managingOrganization?: { reference: string; display?: string };
  /** Identifiant du dossier conservé, si cette fiche a été fusionnée. */
  mergedInto?: string;
}

/** Doublon d'identité probable : deux fiches, score de similarité (0 à 1) et détail par critère. */
export interface DuplicateCandidate {
  id: string;
  score: number;
  criteria: Record<'name' | 'birthDate' | 'phone' | 'gender', number | null>;
  a: PatientSummary;
  b: PatientSummary;
}

/** Champs de la fiche dont la fusion laisse choisir la valeur. */
export type MergeField = 'givenName' | 'familyName' | 'gender' | 'birthDate' | 'phone';

/** Côté conservé pour un champ : `a` (dossier conservé) ou `b` (dossier fusionné). */
export type MergeSide = 'a' | 'b';

/** Demande de fusion de `b` dans `a`. */
export interface MergeRequest {
  motif: string;
  choix: Partial<Record<MergeField, MergeSide>>;
  versions?: { a: number; b: number };
}

/** Fusion effectuée (annulable tant que les fiches n'ont pas changé). */
export interface MergeOutcome {
  id: string;
  keptId: string;
  mergedId: string;
  undone: boolean;
  moved: { encounters: number; observations: number; medicationRequests: number; documents: number };
}

/** Médicament en cours affiché dans la colonne de droite du dossier. */
export interface TreatmentSummary {
  label: string;
  /** Posologie lisible (ex. « 5 mg · 1×/j »). */
  dosage: string;
  /** Concerné par une alerte d'interaction. */
  flagged: boolean;
}

/** Constante vitale ou mesure récente. */
export interface VitalSummary {
  label: string;
  value: string;
  unit: string;
}

/** Membre de l'équipe de soins. */
export interface CareTeamMember {
  id: string;
  name: string;
  role: string;
}

/** Données complémentaires du dossier : en-tête et colonne de droite. */
export interface PatientOverview {
  gender: 'female' | 'male' | 'other' | 'unknown';
  /** Libellés des allergies (badge d'alerte). */
  allergies: string[];
  anticoagulant: boolean;
  version: number;
  vitals: VitalSummary[];
  treatments: TreatmentSummary[];
  careTeam: CareTeamMember[];
}

/** Demande d'accès d'urgence (bris de glace). */
export interface BreakGlassRequest {
  /** Motif choisi dans la liste. */
  motif: string;
  /** Précisions obligatoires. */
  precisions: string;
}

/** Accès exceptionnel accordé. */
export interface BreakGlassGrant {
  patientId: string;
  expiresAt: string;
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

/** Type d'une entité extraite d'un document. */
export type ExtractedEntityKind = 'medication' | 'diagnosis' | 'posology' | 'date';

/** Entité extraite, à valider par un soignant avant tout enregistrement. */
export interface ExtractedEntityRow {
  /** Texte tel que lu dans le document. */
  sourceText: string;
  kind: ExtractedEntityKind;
  /** Valeur normalisée (ex. « Ibuprofène »). */
  normalized: string;
  /** Code ATC ou CIM-10 (absent pour les posologies et les dates). */
  code?: string;
  /** Confiance entre 0 et 1. */
  confidence: number;
}

/** Statut des deux branches après l'identification : clinique (6a) et analytique (6b). */
export interface IngestionBranches {
  clinical: IngestionStepStatus;
  analytic: IngestionStepStatus;
}

/** Résultat d'un import. */
export interface IngestionResult {
  documentId: string;
  steps: IngestionStep[];
  branches: IngestionBranches;
  entities: ExtractedEntityRow[];
}

/** Fichier choisi par l'utilisateur. */
export interface ChosenFile {
  name: string;
  size?: number;
  /** Contenu du fichier (absent dans les tests en mémoire). */
  content?: Blob;
}

/** Mot par mot : fonction appelée pour chaque mot de la réponse reçue au fil de l'eau. */
export type WordHandler = (word: string) => void;

/** Version immuable d'une ressource du dossier (fiche patient ou document), telle que servie par Dossiers. */
export interface ResourceVersion {
  resourceId: string;
  resourceType: 'Patient' | 'DocumentReference';
  number: number;
  /** Identifiant de l'auteur (`système` pour l'état initial). */
  author: string;
  /** Date ISO de la modification. */
  createdAt: string;
  reason: string;
  /** Contenu complet de la ressource à cette version. */
  content: Record<string, unknown>;
}
