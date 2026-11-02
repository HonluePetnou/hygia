/** Identifiant UUID stable d'une ressource. */
export type Uuid = string;

/** Horodatage ISO 8601 (date ou date-heure). */
export type IsoDateTime = string;

/** Langue d'un document ou d'une interface. */
export type Language = 'fr' | 'en';

/** Rôles applicatifs (contrôle d'accès). */
export type Role =
  'medecin' | 'infirmier' | 'administratif' | 'analyste' | 'patient' | 'admin' | 'auditeur';

/** Liste des rôles, utile pour la validation à l'exécution. */
export const ROLES: readonly Role[] = [
  'medecin',
  'infirmier',
  'administratif',
  'analyste',
  'patient',
  'admin',
  'auditeur',
];

/** Référence vers une autre ressource (`Type/uuid`). */
export interface Reference {
  /** Référence au format `ResourceType/id`. */
  reference: string;
  /** Libellé lisible optionnel. */
  display?: string;
}

/** Concept codé (CIM-10, ATC, LOINC…). */
export interface Coding {
  /** Système de codage (ex. `http://hl7.org/fhir/sid/icd-10`). */
  system: string;
  /** Code dans le système. */
  code: string;
  /** Libellé du code. */
  display: string;
}

/** Champs communs à toute ressource HYGIA. */
export interface BaseResource {
  /** UUID stable de la ressource. */
  id: Uuid;
  /** Numéro de version entier (contrôle optimiste de concurrence). */
  version: number;
}
