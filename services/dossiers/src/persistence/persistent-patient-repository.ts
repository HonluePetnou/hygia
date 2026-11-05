import type { AllergyIntolerance, DocumentReference, Patient, Practitioner } from '@hygia/types';
import type { ConsultationInput, ConsultationResources } from '../consultations/consultation.js';
import {
  InMemoryPatientRepository,
  type DemoDataset,
} from '../patients/in-memory-patient-repository.js';
import type {
  DocumentChanges,
  MergeRecord,
  MergeableFields,
  PatientRecord,
  PatientRepository,
  SaveResult,
} from '../patients/patient-repository.js';
import type { ResourceStore, StoredResource } from './resource-store.js';

/** Champs du jeu de données et type FHIR de leurs ressources. */
const COLLECTIONS = {
  organizations: 'Organization',
  practitioners: 'Practitioner',
  careTeams: 'CareTeam',
  patients: 'Patient',
  allergies: 'AllergyIntolerance',
  conditions: 'Condition',
  encounters: 'Encounter',
  observations: 'Observation',
  medicationRequests: 'MedicationRequest',
  documents: 'DocumentReference',
} as const satisfies Record<keyof DemoDataset, string>;

type Collection = keyof typeof COLLECTIONS;
type Resource = { id: string; version?: number; subject?: { reference: string } };

const keyOf = (row: Pick<StoredResource, 'resourceType' | 'id'>) => `${row.resourceType}/${row.id}`;

/** Ressources du jeu de données → lignes stockées. */
export function datasetToRows(dataset: DemoDataset): StoredResource[] {
  const rows: StoredResource[] = [];
  for (const [collection, resourceType] of Object.entries(COLLECTIONS)) {
    for (const item of dataset[collection as Collection] as readonly Resource[]) {
      const patientId =
        resourceType === 'Patient'
          ? item.id
          : (item.subject?.reference.startsWith('Patient/')
              ? item.subject.reference.slice('Patient/'.length)
              : null);
      rows.push({ resourceType, id: item.id, patientId, version: item.version ?? 1, body: item });
    }
  }
  return rows;
}

/** Lignes stockées → jeu de données (ressources de chaque type, dans l'ordre de lecture). */
export function rowsToDataset(rows: readonly StoredResource[]): DemoDataset {
  const dataset = Object.fromEntries(
    Object.keys(COLLECTIONS).map((collection) => [collection, [] as unknown[]]),
  ) as Record<Collection, unknown[]>;
  const collectionOf = new Map(
    Object.entries(COLLECTIONS).map(([collection, type]) => [type as string, collection as Collection]),
  );
  for (const row of rows) {
    const collection = collectionOf.get(row.resourceType);
    if (collection !== undefined) dataset[collection].push(row.body);
  }
  return dataset as unknown as DemoDataset;
}

export interface PersistenceOptions {
  warn?: (message: string) => void;
}

/**
 * Dépôt durable : l'implémentation en mémoire reste le cache de travail (lecture synchrone,
 * services inchangés) ; au démarrage elle est chargée depuis la base (remplie avec le jeu de
 * données si elle est vide), et après chaque modification les ressources changées sont écrites,
 * dans l'ordre. Base injoignable : le dépôt continue, les écritures repartent au changement suivant.
 */
export class PersistentPatientRepository implements PatientRepository {
  /** Contenu JSON de chaque ressource telle qu'en base (pour n'écrire que ce qui change). */
  private readonly persisted = new Map<string, string>();
  private writing: Promise<void> = Promise.resolve();
  private readonly warn: (message: string) => void;
  /** Nombre de ressources de la dernière écriture réussie (diagnostic, tests). */
  lastWriteSize = 0;

  private constructor(
    private readonly memory: InMemoryPatientRepository,
    private readonly store: ResourceStore,
    rows: readonly StoredResource[],
    options: PersistenceOptions,
  ) {
    this.warn = options.warn ?? ((message) => console.warn(message));
    for (const row of rows) this.persisted.set(keyOf(row), JSON.stringify(row.body));
  }

  /** Charge le dépôt depuis la base ; base vide : la remplit avec `seed`. */
  static async open(
    store: ResourceStore,
    seed: DemoDataset,
    options: PersistenceOptions = {},
  ): Promise<PersistentPatientRepository> {
    let rows = await store.loadAll();
    if (rows.length === 0) {
      rows = datasetToRows(seed);
      await store.upsert(rows);
    }
    return new PersistentPatientRepository(
      new InMemoryPatientRepository(rowsToDataset(rows)),
      store,
      rows,
      options,
    );
  }

  /** Attend la fin des écritures en cours (tests, arrêt). */
  flush(): Promise<void> {
    return this.writing;
  }

  private sync(): void {
    this.writing = this.writing.then(() => this.writeChanges());
  }

  private async writeChanges(): Promise<void> {
    const changed = datasetToRows(this.memory.snapshot()).filter(
      (row) => this.persisted.get(keyOf(row)) !== JSON.stringify(row.body),
    );
    if (changed.length === 0) return;
    try {
      await this.store.upsert(changed);
    } catch (error) {
      this.warn(
        `Dossiers : écriture en base en attente (${changed.length} ressource(s)) : ${String(error)}`,
      );
      return;
    }
    for (const row of changed) this.persisted.set(keyOf(row), JSON.stringify(row.body));
    this.lastWriteSize = changed.length;
  }

  // Lectures : le cache en mémoire.
  search(query: string): Patient[] {
    return this.memory.search(query);
  }
  findById(id: string): Patient | undefined {
    return this.memory.findById(id);
  }
  findDocument(id: string): DocumentReference | undefined {
    return this.memory.findDocument(id);
  }
  recordOf(patientId: string): PatientRecord {
    return this.memory.recordOf(patientId);
  }
  allergiesOf(patientId: string): AllergyIntolerance[] {
    return this.memory.allergiesOf(patientId);
  }
  organizationName(organizationId: string): string | undefined {
    return this.memory.organizationName(organizationId);
  }
  patientIdsOfCareTeams(practitionerId: string): ReadonlySet<string> {
    return this.memory.patientIdsOfCareTeams(practitionerId);
  }
  careTeamOf(patientId: string): Practitioner[] {
    return this.memory.careTeamOf(patientId);
  }
  activePatients(): Patient[] {
    return this.memory.activePatients();
  }

  // Écritures : le cache, puis la base.
  update(
    id: string,
    changes: Partial<Pick<Patient, 'givenName' | 'familyName' | 'gender' | 'birthDate'>>,
    expectedVersion: number,
  ): SaveResult {
    const result = this.memory.update(id, changes, expectedVersion);
    if (result.status === 'saved') this.sync();
    return result;
  }
  updateDocument(
    id: string,
    changes: DocumentChanges,
    expectedVersion: number,
  ): SaveResult<DocumentReference> {
    const result = this.memory.updateDocument(id, changes, expectedVersion);
    if (result.status === 'saved') this.sync();
    return result;
  }
  addConsultation(
    patientId: string,
    practitionerId: string,
    input: ConsultationInput,
    at: Date,
  ): ConsultationResources {
    const resources = this.memory.addConsultation(patientId, practitionerId, input, at);
    this.sync();
    return resources;
  }
  merge(keptId: string, mergedId: string, fields: MergeableFields): MergeRecord {
    const record = this.memory.merge(keptId, mergedId, fields);
    this.sync();
    return record;
  }
  unmerge(record: MergeRecord): void {
    this.memory.unmerge(record);
    this.sync();
  }
}
