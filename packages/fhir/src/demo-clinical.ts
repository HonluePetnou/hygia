import type {
  AllergyIntolerance,
  Condition,
  DocumentReference,
  Encounter,
  MedicationRequest,
  Observation,
} from '@hygia/types';
import { FLORENCE_ID, NANA_ID, ref } from './demo-admin.js';
import { demoId, ID_PREFIX } from './demo-ids.js';

const subject = ref('Patient', FLORENCE_ID, 'Florence Ngo Bassa');
const nana = ref('Practitioner', NANA_ID, 'Dr Aïcha Nana');

const doc = (
  n: number,
  documentType: string,
  title: string,
  language: DocumentReference['language'],
  date: string,
): DocumentReference => ({
  resourceType: 'DocumentReference',
  id: demoId(ID_PREFIX.document, n),
  version: 1,
  subject,
  documentType,
  title,
  language,
  date,
  processingStatus: 'processed',
});

/** 5 documents de Florence, dont l'échographie en anglais (FEVG 45 %). */
export const florenceDocuments: DocumentReference[] = [
  doc(1, 'Compte rendu de consultation', 'Consultation de cardiologie', 'fr', '2026-01-15'),
  doc(
    2,
    'Compte rendu d’hospitalisation',
    'Hospitalisation pour insuffisance cardiaque',
    'fr',
    '2026-03-02',
  ),
  doc(3, 'Compte rendu d’échographie', 'Echocardiography report (LVEF 45%)', 'en', '2026-06-03'),
  doc(4, 'Résultats de biologie', 'Bilan biologique et INR', 'fr', '2026-10-14'),
  doc(5, 'Ordonnance', 'Ordonnance du 28 octobre 2026', 'fr', '2026-10-28'),
];

const observation = (
  n: number,
  code: Observation['code'],
  value: number,
  unit: string,
  effectiveDate: string,
): Observation => ({
  resourceType: 'Observation',
  id: demoId(ID_PREFIX.observation, n),
  version: 1,
  subject,
  code,
  value,
  unit,
  effectiveDate,
});

/** INR 2,8 (2026-10-14) et FEVG 45 % (2026-06-03). */
export const florenceObservations: Observation[] = [
  observation(
    1,
    { system: 'http://loinc.org', code: '34714-6', display: 'INR' },
    2.8,
    'ratio',
    '2026-10-14',
  ),
  observation(
    2,
    { system: 'http://loinc.org', code: '10230-1', display: 'FEVG' },
    45,
    '%',
    '2026-06-03',
  ),
];

/** Fibrillation auriculaire et insuffisance cardiaque (CIM-10). */
export const florenceConditions: Condition[] = [
  {
    resourceType: 'Condition',
    id: demoId(ID_PREFIX.condition, 1),
    version: 1,
    subject,
    code: {
      system: 'http://hl7.org/fhir/sid/icd-10',
      code: 'I48',
      display: 'Fibrillation auriculaire',
    },
    onsetDate: '2022-05-10',
  },
  {
    resourceType: 'Condition',
    id: demoId(ID_PREFIX.condition, 2),
    version: 1,
    subject,
    code: {
      system: 'http://hl7.org/fhir/sid/icd-10',
      code: 'I50',
      display: 'Insuffisance cardiaque',
    },
    onsetDate: '2026-03-02',
  },
];

/** Warfarine 5 mg/j et ibuprofène 400 mg × 3/j (prescrit le 2026-10-28). */
export const florenceMedications: MedicationRequest[] = [
  {
    resourceType: 'MedicationRequest',
    id: demoId(ID_PREFIX.medication, 1),
    version: 1,
    subject,
    requester: nana,
    medication: { system: 'http://www.whocc.no/atc', code: 'B01AA03', display: 'Warfarine' },
    dosage: { doseValue: 5, doseUnit: 'mg', timesPerDay: 1 },
    authoredOn: '2022-05-10',
  },
  {
    resourceType: 'MedicationRequest',
    id: demoId(ID_PREFIX.medication, 2),
    version: 1,
    subject,
    requester: nana,
    medication: { system: 'http://www.whocc.no/atc', code: 'M01AE01', display: 'Ibuprofène' },
    dosage: { doseValue: 400, doseUnit: 'mg', timesPerDay: 3 },
    authoredOn: '2026-10-28',
  },
];

/** Allergie à la pénicilline. */
export const florenceAllergies: AllergyIntolerance[] = [
  {
    resourceType: 'AllergyIntolerance',
    id: demoId(ID_PREFIX.allergy, 1),
    version: 1,
    subject,
    substance: { system: 'http://www.whocc.no/atc', code: 'J01CE', display: 'Pénicilline' },
    criticality: 'high',
  },
];

/** Consultation de cardiologie du 2026-10-28. */
export const florenceEncounters: Encounter[] = [
  {
    resourceType: 'Encounter',
    id: demoId(ID_PREFIX.encounter, 1),
    version: 1,
    subject,
    practitioner: nana,
    encounterClass: 'ambulatory',
    start: '2026-10-28T09:00:00Z',
    end: '2026-10-28T09:30:00Z',
  },
];
