import type { Language } from '@hygia/types';

/** Finalités du traitement des données (maquette 13, « Mes consentements »). */
export const CONSENT_PURPOSES = ['soins', 'ia', 'statistiques', 'audio', 'whatsapp'] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

/** Finalité indispensable à la prise en charge : elle ne se révoque pas. */
export const REQUIRED_PURPOSE: ConsentPurpose = 'soins';

/** Valeur initiale de chaque finalité pour un patient qui n'a encore rien choisi. */
export const DEFAULT_GRANTED: Record<ConsentPurpose, boolean> = {
  soins: true,
  ia: true,
  statistiques: true,
  audio: false,
  whatsapp: true,
};

/** Consentement d'un patient à une finalité : UUID stable, version (contrôle optimiste), révocation. */
export interface Consent {
  id: string;
  version: number;
  patientId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  /** Date (ISO 8601) du dernier octroi. */
  grantedAt?: string;
  /** Date (ISO 8601) de la dernière révocation, absente si le consentement est actif. */
  revokedAt?: string;
}

/** Consentements et langue d'un patient, tels que le portail les affiche. */
export interface ConsentSheet {
  patientId: string;
  language: Language;
  consents: Consent[];
}
