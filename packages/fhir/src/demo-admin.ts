import type { CareTeam, Organization, Patient, Practitioner, Reference } from '@hygia/types';
import { demoId, ID_PREFIX } from './demo-ids.js';

/** Construit une référence `Type/id`. */
export function ref(type: string, id: string, display?: string): Reference {
  return display === undefined
    ? { reference: `${type}/${id}` }
    : { reference: `${type}/${id}`, display };
}

const orgId = (n: number): string => demoId(ID_PREFIX.organization, n);
const prId = (n: number): string => demoId(ID_PREFIX.practitioner, n);
const patId = (n: number): string => demoId(ID_PREFIX.patient, n);

/** Identifiant de Florence Ngo Bassa, patiente de référence. */
export const FLORENCE_ID = patId(1);
/** Identifiant du Dr Aïcha Nana. */
export const NANA_ID = prId(1);

/** Les 3 établissements fictifs. */
export const demoOrganizations: Organization[] = [
  {
    resourceType: 'Organization',
    id: orgId(1),
    version: 1,
    name: 'Hôpital de district de Bonassama',
    city: 'Douala',
  },
  {
    resourceType: 'Organization',
    id: orgId(2),
    version: 1,
    name: 'CMA de Bépanda',
    city: 'Douala',
  },
  { resourceType: 'Organization', id: orgId(3), version: 1, name: 'CSI de Mora', city: 'Mora' },
];

const practitioner = (
  n: number,
  name: string,
  role: Practitioner['role'],
  specialty: string,
  org: number,
): Practitioner => ({
  resourceType: 'Practitioner',
  id: prId(n),
  version: 1,
  name,
  role,
  specialty,
  organization: ref('Organization', orgId(org)),
});

/** Les 6 praticiens fictifs. */
export const demoPractitioners: Practitioner[] = [
  practitioner(1, 'Dr Aïcha Nana', 'medecin', 'Cardiologie', 1),
  practitioner(2, 'Rose Mballa', 'infirmier', 'Soins infirmiers', 1),
  practitioner(3, 'Dr Paul Kamga', 'medecin', 'Médecine générale', 2),
  practitioner(4, 'Dr Bertrand Ondoa', 'medecin', 'Urgences', 1),
  practitioner(5, 'Marthe Eyenga', 'administratif', 'Accueil et admissions', 1),
  practitioner(6, 'Samuel Tchoua', 'infirmier', 'Soins infirmiers', 3),
];

const patient = (
  n: number,
  givenName: string,
  familyName: string,
  gender: Patient['gender'],
  birthDate: string,
  org: number,
): Patient => ({
  resourceType: 'Patient',
  id: patId(n),
  version: 1,
  ipp: `HYG-2024-${String(870 + n).padStart(5, '0')}`,
  familyName,
  givenName,
  gender,
  birthDate,
  managingOrganization: ref('Organization', orgId(org), demoOrganizations[org - 1]?.name),
});

const withPhone = (base: Patient, phone: string): Patient => ({ ...base, phone });

/** Les 8 premiers patients fictifs (le 9e, doublon de Florence : `demo-doublon.ts`) ; Florence a l'IPP HYG-2024-00871, 71 ans en 2026. */
export const demoPatients: Patient[] = [
  withPhone(patient(1, 'Florence', 'Ngo Bassa', 'female', '1955-03-12', 1), '+237 699 12 34 65'),
  patient(2, 'Jean', 'Mbarga', 'male', '1980-07-02', 1),
  patient(3, 'Estelle', 'Fotso', 'female', '1992-11-23', 2),
  patient(4, 'Henri', 'Essomba', 'male', '1968-01-30', 2),
  patient(5, 'Amina', 'Bello', 'female', '2001-05-17', 3),
  patient(6, 'Pierre', 'Njoya', 'male', '1947-09-09', 1),
  patient(7, 'Clarisse', 'Atangana', 'female', '1986-04-04', 2),
  patient(8, 'Moussa', 'Hamadou', 'male', '1975-12-25', 3),
];

/** Équipe de soins Cardiologie. */
export const demoCareTeams: CareTeam[] = [
  {
    resourceType: 'CareTeam',
    id: demoId(ID_PREFIX.careTeam, 1),
    version: 1,
    name: 'Cardiologie',
    participants: [ref('Practitioner', prId(1)), ref('Practitioner', prId(2))],
    managingOrganization: ref('Organization', orgId(1)),
  },
];
