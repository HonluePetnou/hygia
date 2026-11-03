import type { Locale } from '@hygia/i18n';

/** Finalités de consentement (même vocabulaire que le service Dossiers). */
export const CONSENT_PURPOSES = ['soins', 'ia', 'statistiques', 'audio', 'whatsapp'] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

/** Consentement d'un patient à une finalité (ressource `Consent`). */
export interface ConsentData {
  id: string;
  version: number;
  patientId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  grantedAt?: string;
  revokedAt?: string;
}

/** Consentements et langue du patient. */
export interface ConsentSheetData {
  patientId: string;
  language: Locale;
  consents: ConsentData[];
}

/** Prochain rendez-vous affiché dans le bandeau. */
export interface NextAppointmentData {
  id: string;
  startsAt: string;
  clinician?: string;
  service?: string;
  site?: string;
}

/** Demandes adressées à la DPO (même vocabulaire que le service Audit). */
export const RIGHTS_KINDS = [
  'telechargement',
  'rectification',
  'suppression',
  'signalement',
] as const;
export type RightsKind = (typeof RIGHTS_KINDS)[number];

/** Demande enregistrée par le service Audit. */
export interface RightsRequestData {
  id: string;
  version: number;
  patientId: string;
  kind: RightsKind;
  message: string;
  eventIndex?: number;
  eventSummary?: string;
  createdAt: string;
  dueAt: string;
  status: 'ouverte';
}

/** Champs d'une nouvelle demande. */
export interface RightsRequestInput {
  kind: RightsKind;
  message: string;
  eventIndex?: number;
}
