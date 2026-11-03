import type { demoDataset } from '@hygia/fhir';
import type {
  AllergyIntolerance,
  Condition,
  MedicationRequest,
  Observation,
  Uuid,
} from '@hygia/types';

/** Jeton d'injection de `ClinicalDirectory`. */
export const CLINICAL_DIRECTORY = Symbol('CLINICAL_DIRECTORY');

/** Données structurées d'un patient, base du résumé. */
export interface ClinicalRecord {
  conditions: Condition[];
  medicationRequests: MedicationRequest[];
  observations: Observation[];
  allergies: AllergyIntolerance[];
}

/** Lecture seule des patients et de leurs équipes de soins (service Dossiers via le broker ensuite). */
export interface ClinicalDirectory {
  exists(patientId: Uuid): boolean;
  /** Vrai si le praticien appartient à l'équipe de soins qui suit ce patient. */
  isInCareTeam(practitionerId: string, patientId: Uuid): boolean;
  recordOf(patientId: Uuid): ClinicalRecord;
}

type DemoDataset = typeof demoDataset;

const idOf = (reference: { reference: string }): string => reference.reference.split('/')[1] ?? '';

/** Annuaire en mémoire alimenté par le jeu de données fictif ; même règle d'équipe que 004. */
export class DemoClinicalDirectory implements ClinicalDirectory {
  constructor(private readonly data: DemoDataset) {}

  exists(patientId: Uuid): boolean {
    return this.data.patients.some((patient) => patient.id === patientId);
  }

  isInCareTeam(practitionerId: string, patientId: Uuid): boolean {
    const colleagues = new Set<string>();
    for (const team of this.data.careTeams) {
      const members = team.participants.map(idOf);
      if (members.includes(practitionerId)) members.forEach((member) => colleagues.add(member));
    }
    const followed =
      this.data.encounters.some(
        (e) => idOf(e.subject) === patientId && colleagues.has(idOf(e.practitioner)),
      ) ||
      this.data.medicationRequests.some(
        (m) => idOf(m.subject) === patientId && colleagues.has(idOf(m.requester)),
      );
    return followed;
  }

  recordOf(patientId: Uuid): ClinicalRecord {
    const mine = <T extends { subject: { reference: string } }>(items: readonly T[]): T[] =>
      items.filter((item) => idOf(item.subject) === patientId);
    return {
      conditions: mine(this.data.conditions),
      medicationRequests: mine(this.data.medicationRequests),
      observations: mine(this.data.observations),
      allergies: mine(this.data.allergies),
    };
  }
}
