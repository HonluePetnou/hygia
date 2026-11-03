import { FLORENCE_ID } from '@hygia/fhir';
import type { AuditLog } from './audit-log.js';
import type { AuditEntryInput } from './types.js';

const FLORENCE = FLORENCE_ID;

const DEMO_ENTRIES: readonly AuditEntryInput[] = [
  { actor: 'aicha.nana', role: 'medecin', action: 'lecture', resourceType: 'Patient', resourceId: FLORENCE, patientId: FLORENCE, reason: 'Consultation' },
  { actor: 'aicha.nana', role: 'medecin', action: 'question_copilote', resourceType: 'Patient', resourceId: FLORENCE, patientId: FLORENCE, reason: 'Copilote : traitement en cours' },
  { actor: 'paul.mbarga', role: 'infirmier', action: 'modification', resourceType: 'Observation', resourceId: 'obs-12', patientId: FLORENCE, reason: 'Saisie des constantes' },
  { actor: 'dr.eyenga', role: 'medecin', action: 'bris_de_glace', resourceType: 'Patient', resourceId: FLORENCE, patientId: FLORENCE, reason: 'Urgence vitale' },
  { actor: 'marie.tchoua', role: 'administratif', action: 'import_document', resourceType: 'DocumentReference', resourceId: 'doc-7', patientId: FLORENCE, reason: 'Import du compte rendu' },
];

/** Entrées fictives pour la démonstration locale. */
export function seedDemoEntries(log: AuditLog): void {
  for (const entry of DEMO_ENTRIES) log.append(entry);
}
