import type { MedicationRequest } from '@hygia/types';

/** Code ATC de la warfarine. */
export const WARFARIN = 'B01AA03';
/** Code ATC de l'ibuprofène. */
export const IBUPROFEN = 'M01AE01';
/** Anticoagulants signalés dans l'en-tête du dossier (warfarine, rivaroxaban, apixaban). */
export const ANTICOAGULANTS: ReadonlySet<string> = new Set([WARFARIN, 'B01AF01', 'B01AF02']);

/** Paire warfarine + ibuprofène prescrite au même patient, si elle existe. */
export function warfarinIbuprofenPair(
  medications: readonly MedicationRequest[],
): { warfarin: MedicationRequest; ibuprofen: MedicationRequest } | undefined {
  const warfarin = medications.find((m) => m.medication.code === WARFARIN);
  const ibuprofen = medications.find((m) => m.medication.code === IBUPROFEN);
  return warfarin && ibuprofen ? { warfarin, ibuprofen } : undefined;
}
