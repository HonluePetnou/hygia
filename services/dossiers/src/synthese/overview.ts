import type { AllergyIntolerance, Patient, Practitioner } from '@hygia/types';
import type { PatientRecord } from '../patients/patient-repository.js';
import { ANTICOAGULANTS, IBUPROFEN, WARFARIN, warfarinIbuprofenPair } from './clinical-rules.js';

/** Synthèse du dossier : en-tête (allergies, anticoagulant) et colonne de droite du client web. */
export interface PatientOverview {
  gender: Patient['gender'];
  allergies: string[];
  anticoagulant: boolean;
  version: number;
  vitals: { label: string; value: string; unit: string }[];
  treatments: { label: string; dosage: string; flagged: boolean }[];
  careTeam: { id: string; name: string; role: string }[];
}

/** Construit la synthèse d'un patient à partir de son dossier. */
export function buildOverview(
  patient: Patient,
  record: PatientRecord,
  allergies: readonly AllergyIntolerance[],
  careTeam: readonly Practitioner[],
): PatientOverview {
  const medications = record.medicationRequests;
  const interaction = warfarinIbuprofenPair(medications) !== undefined;
  return {
    gender: patient.gender,
    allergies: allergies.map((a) => a.substance.display),
    anticoagulant: medications.some((m) => ANTICOAGULANTS.has(m.medication.code)),
    version: patient.version,
    vitals: record.observations.map((o) => ({
      label: o.code.display,
      value: String(o.value),
      unit: o.unit,
    })),
    treatments: medications.map((m) => ({
      label: m.medication.display,
      dosage: `${m.dosage.doseValue} ${m.dosage.doseUnit} · ${m.dosage.timesPerDay}×/j`,
      flagged: interaction && [WARFARIN, IBUPROFEN].includes(m.medication.code),
    })),
    careTeam: careTeam.map((p) => ({ id: p.id, name: p.name, role: p.specialty })),
  };
}
