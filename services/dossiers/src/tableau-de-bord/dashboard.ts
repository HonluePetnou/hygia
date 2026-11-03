import type { AllergyIntolerance, Patient } from '@hygia/types';
import type { PatientRecord } from '../patients/patient-repository.js';
import { warfarinIbuprofenPair } from '../synthese/clinical-rules.js';

/** Alerte du tableau de bord ; le client web en produit le libellé dans la langue choisie. */
export interface DashboardAlert {
  id: string;
  patientId: string;
  severity: 'low' | 'moderate' | 'high';
  kind: 'allergy' | 'interaction';
  params: Record<string, string | number>;
  raisedAt: string;
}

/** Données du tableau de bord d'un soignant (contrat `DashboardData` du client web). */
export interface DashboardData {
  consultations: {
    id: string;
    patientId: string;
    patientName: string;
    start: string;
    reason: string;
    status: 'done' | 'alert';
  }[];
  alerts: DashboardAlert[];
  documentsImported: number;
  documentsInProgress: {
    id: string;
    title: string;
    source: string;
    stage: 'ocr' | 'extraction' | 'done';
    progress: number;
  }[];
  resultsToValidate: number;
  weekActivity: number[];
}

/** Dossier d'un patient visible par l'utilisateur. */
export interface VisibleRecord {
  patient: Patient;
  record: PatientRecord;
  allergies: readonly AllergyIntolerance[];
}

/** Activité fictive de la semaine (consultations par jour, du lundi au dimanche). */
const DEMO_WEEK_ACTIVITY = [14, 17, 12, 19, 16, 6, 3];

/** Avancement fictif des trois derniers documents dans la chaîne d'ingestion. */
const DEMO_STAGES = [
  { stage: 'extraction', progress: 72, source: 'WhatsApp · photo' },
  { stage: 'ocr', progress: 38, source: 'Upload web · PDF' },
  { stage: 'done', progress: 100, source: 'API FHIR · Laboratoire' },
] as const;

/** Allergies graves et interaction warfarine + ibuprofène des patients visibles. */
export function dashboardAlerts(records: readonly VisibleRecord[]): DashboardAlert[] {
  return records.flatMap(({ patient, record, allergies }) => {
    const alerts: DashboardAlert[] = allergies
      .filter((a) => a.criticality === 'high')
      .map((a) => ({
        id: a.id,
        patientId: patient.id,
        severity: 'high',
        kind: 'allergy',
        params: { label: a.substance.display, criticality: a.criticality },
        raisedAt: new Date(0).toISOString(),
      }));
    const pair = warfarinIbuprofenPair(record.medicationRequests);
    if (pair) {
      alerts.push({
        id: `${pair.warfarin.id}:${pair.ibuprofen.id}`,
        patientId: patient.id,
        severity: 'high',
        kind: 'interaction',
        params: {
          first: pair.warfarin.medication.display,
          second: pair.ibuprofen.medication.display,
        },
        raisedAt: pair.ibuprofen.authoredOn,
      });
    }
    return alerts;
  });
}

/**
 * Tableau de bord limité aux patients visibles : consultations du jour `day` (`AAAA-MM-JJ`),
 * alertes, documents et résultats à valider.
 */
export function buildDashboard(records: readonly VisibleRecord[], day: string): DashboardData {
  const alerts = dashboardAlerts(records);
  const flagged = new Set(alerts.map((a) => a.patientId));
  const consultations = records.flatMap(({ patient, record }) =>
    record.encounters
      .filter((e) => e.start.startsWith(day))
      .map((e) => ({
        id: e.id,
        patientId: patient.id,
        patientName: `${patient.givenName} ${patient.familyName}`,
        start: e.start,
        reason: e.encounterClass,
        status: flagged.has(patient.id) ? ('alert' as const) : ('done' as const),
      })),
  );
  const documents = records
    .flatMap(({ record }) => record.documents)
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    consultations: consultations.sort((a, b) => a.start.localeCompare(b.start)),
    alerts,
    documentsImported: documents.length,
    documentsInProgress: documents.slice(-3).map((d, i) => ({
      id: d.id,
      title: d.title,
      ...(DEMO_STAGES[i] ?? DEMO_STAGES[2]),
    })),
    resultsToValidate: records.reduce((total, { record }) => total + record.observations.length, 0),
    weekActivity: [...DEMO_WEEK_ACTIVITY],
  };
}
