import type { demoDataset } from '@hygia/fhir';
import type { DocumentReference, Patient } from '@hygia/types';
import type {
  DocumentChanges,
  PatientRecord,
  PatientRepository,
  SaveResult,
} from './patient-repository.js';

/** Forme du jeu de données de démonstration (`demoDataset`). */
export type DemoDataset = typeof demoDataset;

const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const idOf = (reference: { reference: string }): string => reference.reference.split('/')[1] ?? '';

/** Dépôt en mémoire alimenté par un jeu de données fictif (tests et démo). */
export class InMemoryPatientRepository implements PatientRepository {
  private readonly patients = new Map<string, Patient>();
  private readonly documents = new Map<string, DocumentReference>();

  constructor(private readonly data: DemoDataset) {
    for (const patient of data.patients) this.patients.set(patient.id, { ...patient });
    for (const document of data.documents) this.documents.set(document.id, { ...document });
  }

  search(query: string): Patient[] {
    const needle = normalize(query.trim());
    return [...this.patients.values()].filter((patient) =>
      normalize(`${patient.givenName} ${patient.familyName} ${patient.ipp}`).includes(needle),
    );
  }

  findById(id: string): Patient | undefined {
    return this.patients.get(id);
  }

  findDocument(id: string): DocumentReference | undefined {
    return this.documents.get(id);
  }

  recordOf(patientId: string): PatientRecord {
    const mine = <T extends { subject: { reference: string } }>(items: readonly T[]): T[] =>
      items.filter((item) => idOf(item.subject) === patientId);
    return {
      encounters: mine(this.data.encounters),
      observations: mine(this.data.observations),
      medicationRequests: mine(this.data.medicationRequests),
      documents: mine([...this.documents.values()]),
      alerts: [],
    };
  }

  /**
   * Un patient est suivi par une équipe si l'un de ses membres a une consultation ou une
   * prescription le concernant.
   */
  patientIdsOfCareTeams(practitionerId: string): ReadonlySet<string> {
    const colleagues = new Set<string>();
    for (const team of this.data.careTeams) {
      const members = team.participants.map(idOf);
      if (members.includes(practitionerId)) members.forEach((member) => colleagues.add(member));
    }
    const patientIds = new Set<string>();
    for (const encounter of this.data.encounters) {
      if (colleagues.has(idOf(encounter.practitioner))) patientIds.add(idOf(encounter.subject));
    }
    for (const request of this.data.medicationRequests) {
      if (colleagues.has(idOf(request.requester))) patientIds.add(idOf(request.subject));
    }
    return patientIds;
  }

  update(
    id: string,
    changes: Partial<Pick<Patient, 'givenName' | 'familyName' | 'gender' | 'birthDate'>>,
    expectedVersion: number,
  ): SaveResult {
    const current = this.patients.get(id);
    if (!current) return { status: 'not_found' };
    if (current.version !== expectedVersion) {
      return { status: 'conflict', currentVersion: current.version };
    }
    const patient: Patient = { ...current, ...changes, version: current.version + 1 };
    this.patients.set(id, patient);
    return { status: 'saved', resource: patient };
  }

  updateDocument(
    id: string,
    changes: DocumentChanges,
    expectedVersion: number,
  ): SaveResult<DocumentReference> {
    const current = this.documents.get(id);
    if (!current) return { status: 'not_found' };
    if (current.version !== expectedVersion) {
      return { status: 'conflict', currentVersion: current.version };
    }
    const document: DocumentReference = { ...current, ...changes, version: current.version + 1 };
    this.documents.set(id, document);
    return { status: 'saved', resource: document };
  }
}
