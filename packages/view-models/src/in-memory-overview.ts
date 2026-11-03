import type { Dataset } from './in-memory-knowledge.js';
import type {
  DocumentInProgress,
  PatientOverview,
  TimelineEntry,
  TreatmentSummary,
} from './types.js';

const WARFARIN = 'B01AA03';
const IBUPROFEN = 'M01AE01';
const ANTICOAGULANTS = new Set([WARFARIN, 'B01AF01', 'B01AF02']);

/** Activité démo de la semaine (consultations par jour, lundi à dimanche). */
export const DEMO_WEEK_ACTIVITY: readonly number[] = [14, 17, 12, 19, 16, 6, 3];

const mine = <T extends { subject: { reference: string } }>(rows: readonly T[], id: string): T[] =>
  rows.filter((r) => r.subject.reference === `Patient/${id}`);

/** Constantes, traitements et équipe de soins d'un patient à partir du jeu de données. */
export function buildOverview(dataset: Dataset, patientId: string): PatientOverview {
  const patient = dataset.patients.find((p) => p.id === patientId);
  const medications = mine(dataset.medicationRequests, patientId);
  const hasInteraction =
    medications.some((m) => m.medication.code === WARFARIN) &&
    medications.some((m) => m.medication.code === IBUPROFEN);
  const treatments = medications.map((m): TreatmentSummary => ({
    label: m.medication.display,
    dosage: `${m.dosage.doseValue} ${m.dosage.doseUnit} · ${m.dosage.timesPerDay}×/j`,
    flagged: hasInteraction && [WARFARIN, IBUPROFEN].includes(m.medication.code),
  }));
  const team = dataset.careTeams.filter(
    (c) => c.managingOrganization.reference === patient?.managingOrganization.reference,
  );
  const members = team.flatMap((c) => c.participants.map((p) => p.reference.split('/')[1] ?? ''));
  return {
    gender: patient?.gender ?? 'unknown',
    allergies: mine(dataset.allergies, patientId).map((a) => a.substance.display),
    anticoagulant: medications.some((m) => ANTICOAGULANTS.has(m.medication.code)),
    version: patient?.version ?? 1,
    vitals: mine(dataset.observations, patientId).map((o) => ({
      label: o.code.display,
      value: String(o.value),
      unit: o.unit,
    })),
    treatments,
    careTeam: dataset.practitioners
      .filter((p) => members.includes(p.id))
      .map((p) => ({ id: p.id, name: p.name, role: p.specialty })),
  };
}

/** Auteur et détail d'un événement, quand le jeu de données les connaît. */
export function describeEntry(dataset: Dataset, entry: TimelineEntry): TimelineEntry {
  const [type, id] = entry.resource.reference.split('/');
  if (type === 'Encounter') {
    const encounter = dataset.encounters.find((e) => e.id === id);
    const author = encounter?.practitioner.display;
    return author ? { ...entry, author } : entry;
  }
  if (type === 'MedicationRequest') {
    const request = dataset.medicationRequests.find((m) => m.id === id);
    const { doseValue, doseUnit, timesPerDay } = request?.dosage ?? {};
    const author = request?.requester.display;
    return {
      ...entry,
      ...(request ? { detail: `${doseValue} ${doseUnit}, ${timesPerDay}×/j` } : {}),
      ...(author ? { author } : {}),
    };
  }
  if (type === 'Observation') {
    const observation = dataset.observations.find((o) => o.id === id);
    return observation
      ? { ...entry, detail: `${observation.value} ${observation.unit}` }
      : entry;
  }
  return entry;
}

/** Documents en cours de traitement : les trois derniers documents du jeu de données. */
export function buildDocumentsInProgress(dataset: Dataset): DocumentInProgress[] {
  const stages: Pick<DocumentInProgress, 'stage' | 'progress' | 'source'>[] = [
    { stage: 'extraction', progress: 72, source: 'WhatsApp · photo' },
    { stage: 'ocr', progress: 38, source: 'Upload web · PDF' },
    { stage: 'done', progress: 100, source: 'API FHIR · Laboratoire' },
  ];
  return dataset.documents
    .slice(-3)
    .map((d, i) => ({ id: d.id, title: d.title, ...(stages[i] as (typeof stages)[number]) }));
}
