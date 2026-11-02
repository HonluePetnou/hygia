import type { Reference } from '@hygia/types';
import type { PatientRecord } from './patient-repository.js';

/** Types d'événements de la chronologie. */
export type TimelineEventType = 'consultation' | 'examen' | 'prescription' | 'document' | 'alerte';

/** Événement de la chronologie d'un patient. */
export interface TimelineEvent {
  type: TimelineEventType;
  /** Date ISO de l'événement. */
  date: string;
  /** Ressource d'origine (`Type/uuid`). */
  resource: Reference;
  /** Libellé issu de la donnée (titre, médicament, code…). */
  label: string;
}

/** Assemble la chronologie, du plus récent au plus ancien. */
export function buildTimeline(record: PatientRecord): TimelineEvent[] {
  const events: TimelineEvent[] = [
    ...record.encounters.map((item): TimelineEvent => ({
      type: 'consultation',
      date: item.start,
      resource: { reference: `Encounter/${item.id}` },
      label: item.encounterClass,
    })),
    ...record.observations.map((item): TimelineEvent => ({
      type: 'examen',
      date: item.effectiveDate,
      resource: { reference: `Observation/${item.id}` },
      label: item.code.display,
    })),
    ...record.medicationRequests.map((item): TimelineEvent => ({
      type: 'prescription',
      date: item.authoredOn,
      resource: { reference: `MedicationRequest/${item.id}` },
      label: item.medication.display,
    })),
    ...record.documents.map((item): TimelineEvent => ({
      type: 'document',
      date: item.date,
      resource: { reference: `DocumentReference/${item.id}` },
      label: item.title,
    })),
    ...record.alerts.map(({ issue, raisedAt }): TimelineEvent => ({
      type: 'alerte',
      date: raisedAt,
      resource: { reference: `DetectedIssue/${issue.id}` },
      label: issue.explanation,
    })),
  ];
  return events.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}
