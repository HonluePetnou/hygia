import { randomUUID } from 'node:crypto';
import type { demoDataset } from '@hygia/fhir';
import type {
  AllergyIntolerance,
  Condition,
  DocumentReference,
  Encounter,
  MedicationRequest,
  Observation,
  Patient,
  Practitioner,
} from '@hygia/types';
import type {
  DocumentChanges,
  MergeRecord,
  MergeableFields,
  MovedResources,
  PatientRecord,
  PatientRepository,
  SaveResult,
} from './patient-repository.js';
import type { ConsultationInput, ConsultationResources } from '../consultations/consultation.js';

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
  private readonly encounters = new Map<string, Encounter>();
  private readonly observations = new Map<string, Observation>();
  private readonly medicationRequests = new Map<string, MedicationRequest>();
  private readonly conditions = new Map<string, Condition>();

  constructor(private readonly data: DemoDataset) {
    const load = <T extends { id: string }>(target: Map<string, T>, items: readonly T[]): void => {
      for (const item of items) target.set(item.id, { ...item });
    };
    load<Patient>(this.patients, data.patients);
    load<DocumentReference>(this.documents, data.documents);
    load<Encounter>(this.encounters, data.encounters);
    load<Observation>(this.observations, data.observations);
    load<MedicationRequest>(this.medicationRequests, data.medicationRequests);
    load<Condition>(this.conditions, data.conditions);
  }

  /** État courant complet (ressources modifiables à jour + données partagées), pour la persistance. */
  snapshot(): DemoDataset {
    return {
      ...this.data,
      patients: [...this.patients.values()],
      documents: [...this.documents.values()],
      encounters: [...this.encounters.values()],
      observations: [...this.observations.values()],
      medicationRequests: [...this.medicationRequests.values()],
      conditions: [...this.conditions.values()],
    } as unknown as DemoDataset;
  }

  addConsultation(
    patientId: string,
    practitionerId: string,
    input: ConsultationInput,
    at: Date,
  ): ConsultationResources {
    const patient = this.patients.get(patientId);
    const subject = {
      reference: `Patient/${patientId}`,
      ...(patient ? { display: `${patient.givenName} ${patient.familyName}` } : {}),
    };
    const requester = { reference: `Practitioner/${practitionerId}` };
    const now = at.toISOString();
    const base = { version: 1, subject };
    const encounter: Encounter = {
      ...base,
      resourceType: 'Encounter',
      id: randomUUID(),
      practitioner: requester,
      encounterClass: 'ambulatory',
      start: now,
      end: now,
    };
    const observations = input.observations.map((o): Observation => ({
      ...base,
      resourceType: 'Observation',
      id: randomUUID(),
      code: o.code,
      value: o.value,
      unit: o.unit,
      effectiveDate: now,
    }));
    const conditions = input.conditions.map((code): Condition => ({
      ...base,
      resourceType: 'Condition',
      id: randomUUID(),
      code,
      onsetDate: now,
    }));
    const medicationRequests = input.prescriptions.map((p): MedicationRequest => ({
      ...base,
      resourceType: 'MedicationRequest',
      id: randomUUID(),
      requester,
      medication: p.medication,
      dosage: { doseValue: p.doseValue, doseUnit: p.doseUnit, timesPerDay: p.timesPerDay },
      authoredOn: now,
    }));
    this.encounters.set(encounter.id, encounter);
    for (const o of observations) this.observations.set(o.id, o);
    for (const c of conditions) this.conditions.set(c.id, c);
    for (const m of medicationRequests) this.medicationRequests.set(m.id, m);
    return { encounter, observations, conditions, medicationRequests };
  }

  activePatients(): Patient[] {
    return [...this.patients.values()].filter((patient) => patient.mergedInto === undefined);
  }

  search(query: string): Patient[] {
    const needle = normalize(query.trim());
    return this.activePatients().filter((patient) =>
      normalize(`${patient.givenName} ${patient.familyName} ${patient.ipp}`).includes(needle),
    );
  }

  findById(id: string): Patient | undefined {
    return this.patients.get(id);
  }

  findDocument(id: string): DocumentReference | undefined {
    return this.documents.get(id);
  }

  allergiesOf(patientId: string): AllergyIntolerance[] {
    return this.data.allergies.filter((item) => idOf(item.subject) === patientId);
  }

  organizationName(organizationId: string): string | undefined {
    return this.data.organizations.find((item) => item.id === organizationId)?.name;
  }

  recordOf(patientId: string): PatientRecord {
    const mine = <T extends { subject: { reference: string } }>(items: readonly T[]): T[] =>
      items.filter((item) => idOf(item.subject) === patientId);
    return {
      conditions: mine([...this.conditions.values()]),
      encounters: mine([...this.encounters.values()]),
      observations: mine([...this.observations.values()]),
      medicationRequests: mine([...this.medicationRequests.values()]),
      documents: mine([...this.documents.values()]),
      alerts: [],
    };
  }

  /**
   * Un patient est suivi par une équipe si l'un de ses membres a une consultation ou une
   * prescription le concernant.
   */
  careTeamOf(patientId: string): Practitioner[] {
    const organization = this.patients.get(patientId)?.managingOrganization.reference;
    const members = new Set(
      this.data.careTeams
        .filter((team) => team.managingOrganization.reference === organization)
        .flatMap((team) => team.participants.map(idOf)),
    );
    return this.data.practitioners.filter((practitioner) => members.has(practitioner.id));
  }

  patientIdsOfCareTeams(practitionerId: string): ReadonlySet<string> {
    const colleagues = new Set<string>();
    for (const team of this.data.careTeams) {
      const members = team.participants.map(idOf);
      if (members.includes(practitionerId)) members.forEach((member) => colleagues.add(member));
    }
    const patientIds = new Set<string>();
    for (const encounter of this.encounters.values()) {
      if (colleagues.has(idOf(encounter.practitioner))) patientIds.add(idOf(encounter.subject));
    }
    for (const request of this.medicationRequests.values()) {
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

  merge(keptId: string, mergedId: string, fields: MergeableFields): MergeRecord {
    const kept = this.patients.get(keptId) as Patient;
    const merged = this.patients.get(mergedId) as Patient;
    const keptAfter: Patient = { ...kept, ...fields, version: kept.version + 1 };
    const mergedAfter: Patient = { ...merged, mergedInto: keptId, version: merged.version + 1 };
    const target = {
      reference: `Patient/${keptId}`,
      display: `${keptAfter.givenName} ${keptAfter.familyName}`,
    };
    const moved: MovedResources = {
      encounters: this.moveAll(this.encounters, mergedId, target),
      observations: this.moveAll(this.observations, mergedId, target),
      medicationRequests: this.moveAll(this.medicationRequests, mergedId, target),
      documents: this.moveAll(this.documents, mergedId, target),
    };
    this.patients.set(keptId, keptAfter);
    this.patients.set(mergedId, mergedAfter);
    return { keptBefore: kept, mergedBefore: merged, keptAfter, mergedAfter, moved };
  }

  unmerge(record: MergeRecord): void {
    const back = {
      reference: `Patient/${record.mergedBefore.id}`,
      display: `${record.mergedBefore.givenName} ${record.mergedBefore.familyName}`,
    };
    const restore = <T extends { subject: { reference: string; display?: string } }>(
      map: Map<string, T>,
      ids: readonly string[],
    ): void => {
      for (const id of ids) {
        const item = map.get(id);
        if (item) map.set(id, { ...item, subject: back });
      }
    };
    restore(this.encounters, record.moved.encounters);
    restore(this.observations, record.moved.observations);
    restore(this.medicationRequests, record.moved.medicationRequests);
    restore(this.documents, record.moved.documents);
    this.patients.set(record.keptBefore.id, {
      ...record.keptBefore,
      version: record.keptAfter.version + 1,
    });
    this.patients.set(record.mergedBefore.id, {
      ...record.mergedBefore,
      version: record.mergedAfter.version + 1,
    });
  }

  /** Rattache à `target` toutes les ressources du patient `fromId` ; renvoie leurs identifiants. */
  private moveAll<T extends { id: string; subject: { reference: string; display?: string } }>(
    map: Map<string, T>,
    fromId: string,
    target: { reference: string; display: string },
  ): string[] {
    const ids: string[] = [];
    for (const [id, item] of map) {
      if (idOf(item.subject) !== fromId) continue;
      map.set(id, { ...item, subject: target });
      ids.push(id);
    }
    return ids;
  }
}
