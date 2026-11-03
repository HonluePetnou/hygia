import type { Encounter, Observation, Patient } from '@hygia/types';
import { ref } from './demo-admin.js';
import { demoId, ID_PREFIX } from './demo-ids.js';

/** Identifiant du dossier en doublon de Florence (« BASSA NGO Florence », CMA de Bépanda). */
export const FLORENCE_DOUBLON_ID = demoId(ID_PREFIX.patient, 9);

const NANA_ID = demoId(ID_PREFIX.practitioner, 1);
const subject = ref('Patient', FLORENCE_DOUBLON_ID, 'BASSA NGO Florence');

/** Second dossier de Florence, saisi à la CMA de Bépanda (nom inversé, téléphone mal recopié). */
export const florenceDoublon: Patient = {
  resourceType: 'Patient',
  id: FLORENCE_DOUBLON_ID,
  version: 1,
  ipp: 'HYG-2025-01544',
  familyName: 'BASSA NGO',
  givenName: 'Florence',
  gender: 'female',
  birthDate: '1955-03-12',
  managingOrganization: ref('Organization', demoId(ID_PREFIX.organization, 2), 'CMA de Bépanda'),
  phone: '+237 699 12 34 56',
};

/** Consultation rattachée au dossier en doublon. */
export const doublonEncounters: Encounter[] = [
  {
    resourceType: 'Encounter',
    id: demoId(ID_PREFIX.encounter, 2),
    version: 1,
    subject,
    practitioner: ref('Practitioner', NANA_ID, 'Dr Aïcha Nana'),
    encounterClass: 'ambulatory',
    start: '2025-09-02T10:00:00Z',
    end: '2025-09-02T10:20:00Z',
  },
];

/** Mesure rattachée au dossier en doublon. */
export const doublonObservations: Observation[] = [
  {
    resourceType: 'Observation',
    id: demoId(ID_PREFIX.observation, 3),
    version: 1,
    subject,
    code: { system: 'http://loinc.org', code: '29463-7', display: 'Poids' },
    value: 68,
    unit: 'kg',
    effectiveDate: '2025-09-02',
  },
];
