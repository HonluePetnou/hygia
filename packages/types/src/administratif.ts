import type { BaseResource, IsoDateTime, Reference, Role } from './common.js';

/** Patient (données fictives uniquement). */
export interface Patient extends BaseResource {
  resourceType: 'Patient';
  /** Identifiant permanent du patient (IPP), ex. `HYG-2024-00871`. */
  ipp: string;
  /** Nom de famille. */
  familyName: string;
  /** Prénom(s). */
  givenName: string;
  /** Sexe administratif. */
  gender: 'female' | 'male' | 'other' | 'unknown';
  /** Date de naissance (ISO). */
  birthDate: string;
  /** Établissement de rattachement. */
  managingOrganization: Reference;
}

/** Praticien ou membre du personnel. */
export interface Practitioner extends BaseResource {
  resourceType: 'Practitioner';
  /** Nom complet affiché. */
  name: string;
  /** Rôle applicatif. */
  role: Role;
  /** Spécialité ou fonction (ex. cardiologue). */
  specialty: string;
  /** Établissement d'exercice. */
  organization: Reference;
}

/** Établissement de santé. */
export interface Organization extends BaseResource {
  resourceType: 'Organization';
  /** Nom de l'établissement. */
  name: string;
  /** Ville. */
  city: string;
}

/** Équipe de soins. */
export interface CareTeam extends BaseResource {
  resourceType: 'CareTeam';
  /** Nom de l'équipe (ex. Cardiologie). */
  name: string;
  /** Membres (praticiens). */
  participants: Reference[];
  /** Établissement porteur. */
  managingOrganization: Reference;
}

/** Séjour ou consultation. */
export interface Encounter extends BaseResource {
  resourceType: 'Encounter';
  /** Patient concerné. */
  subject: Reference;
  /** Praticien responsable. */
  practitioner: Reference;
  /** Classe : ambulatoire, hospitalisation, urgence. */
  encounterClass: 'ambulatory' | 'inpatient' | 'emergency';
  /** Début. */
  start: IsoDateTime;
  /** Fin, absente tant que le séjour est ouvert. */
  end?: IsoDateTime;
}
