import type { Dataset } from './in-memory-knowledge.js';
import type { AlertSummary, TimelineEntry } from './types.js';

const WARFARIN = 'B01AA03';
const IBUPROFEN = 'M01AE01';

const idOf = (reference: string): string => reference.split('/')[1] ?? '';

/** Alertes ouvertes : allergies critiques et interaction warfarine + ibuprofène. */
export function buildAlerts(dataset: Dataset): AlertSummary[] {
  const allergies = dataset.allergies
    .filter((a) => a.criticality === 'high')
    .map((a): AlertSummary => ({
      id: a.id,
      patientId: idOf(a.subject.reference),
      severity: 'high',
      kind: 'allergy',
      params: { label: a.substance.display, criticality: a.criticality },
      raisedAt: new Date(0).toISOString(),
    }));
  const interactions = dataset.patients.flatMap((patient): AlertSummary[] => {
    const own = dataset.medicationRequests.filter(
      (m) => m.subject.reference === `Patient/${patient.id}`,
    );
    const warfarin = own.find((m) => m.medication.code === WARFARIN);
    const ibuprofen = own.find((m) => m.medication.code === IBUPROFEN);
    if (!warfarin || !ibuprofen) return [];
    return [
      {
        id: `${warfarin.id}:${ibuprofen.id}`,
        patientId: patient.id,
        severity: 'high',
        kind: 'interaction',
        params: { first: warfarin.medication.display, second: ibuprofen.medication.display },
        raisedAt: ibuprofen.authoredOn,
      },
    ];
  });
  return [...allergies, ...interactions];
}

/** Chronologie d'un patient, du plus récent au plus ancien. */
export function buildTimeline(dataset: Dataset, patientId: string): TimelineEntry[] {
  const subject = `Patient/${patientId}`;
  const mine = <T extends { subject: { reference: string } }>(rows: readonly T[]): T[] =>
    rows.filter((r) => r.subject.reference === subject);
  const entries: TimelineEntry[] = [
    ...mine(dataset.encounters).map((e): TimelineEntry => ({
      type: 'consultation',
      date: e.start,
      resource: { reference: `Encounter/${e.id}` },
      label: e.encounterClass,
    })),
    ...mine(dataset.observations).map((o): TimelineEntry => ({
      type: 'examen',
      date: o.effectiveDate,
      resource: { reference: `Observation/${o.id}` },
      label: o.code.display,
    })),
    ...mine(dataset.medicationRequests).map((m): TimelineEntry => ({
      type: 'prescription',
      date: m.authoredOn,
      resource: { reference: `MedicationRequest/${m.id}` },
      label: m.medication.display,
    })),
    ...mine(dataset.documents).map((d): TimelineEntry => ({
      type: 'document',
      date: d.date,
      resource: { reference: `DocumentReference/${d.id}` },
      label: d.title,
    })),
    ...buildAlerts(dataset)
      .filter((a) => a.patientId === patientId)
      .map((a): TimelineEntry => ({
        type: 'alerte',
        date: a.raisedAt,
        resource: { reference: `DetectedIssue/${a.id}` },
        label: Object.values(a.params).join(' / '),
      })),
  ];
  return entries.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}
