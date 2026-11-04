import { FLORENCE_ID, NANA_ID, demoDataset } from '@hygia/fhir';
import { PersistentPatientRepository } from '../src/persistence/persistent-patient-repository.js';
import type { ResourceStore, StoredResource } from '../src/persistence/resource-store.js';

/** Base fictive en mémoire : survit aux « redémarrages » (nouvelles instances du dépôt). */
class FakeStore implements ResourceStore {
  readonly rows = new Map<string, StoredResource>();
  fail = false;
  writes = 0;

  async loadAll(): Promise<StoredResource[]> {
    return [...this.rows.values()].map((row) => structuredClone(row));
  }

  async upsert(rows: readonly StoredResource[]): Promise<void> {
    if (this.fail) throw new Error('ECONNREFUSED');
    this.writes += 1;
    for (const row of rows) this.rows.set(`${row.resourceType}/${row.id}`, structuredClone(row));
  }
}

const open = (store: FakeStore) =>
  PersistentPatientRepository.open(store, demoDataset, { warn: () => undefined });

describe('persistance du dépôt de Dossiers', () => {
  it('base vide : la remplit avec le jeu de données, puis le relit au démarrage suivant', async () => {
    const store = new FakeStore();
    const repo = await open(store);
    expect(store.rows.size).toBeGreaterThan(0);
    expect(repo.findById(FLORENCE_ID)?.familyName).toBe('Ngo Bassa');

    const restarted = await open(store);
    expect(restarted.findById(FLORENCE_ID)?.givenName).toBe('Florence');
    expect(restarted.patientIdsOfCareTeams(NANA_ID).has(FLORENCE_ID)).toBe(true);
    expect(restarted.allergiesOf(FLORENCE_ID).length).toBeGreaterThan(0);
  });

  it('une modification de fiche survit au redémarrage', async () => {
    const store = new FakeStore();
    const repo = await open(store);
    const result = repo.update(FLORENCE_ID, { givenName: 'Flo' }, 1);
    expect(result.status).toBe('saved');
    await repo.flush();

    const restarted = await open(store);
    expect(restarted.findById(FLORENCE_ID)).toMatchObject({ givenName: 'Flo', version: 2 });
  });

  it('une consultation (rencontre, mesures, prescriptions) survit au redémarrage', async () => {
    const store = new FakeStore();
    const repo = await open(store);
    const before = repo.recordOf(FLORENCE_ID).encounters.length;
    repo.addConsultation(
      FLORENCE_ID,
      NANA_ID,
      {
        observations: [
          { code: { system: 'http://loinc.org', code: '6301-6', display: 'INR' }, value: 2.4, unit: 'ratio' },
        ],
        conditions: [],
        prescriptions: [
          {
            medication: { system: 'http://www.whocc.no/atc', code: 'N02BE01', display: 'Paracétamol' },
            doseValue: 1,
            doseUnit: 'g',
            timesPerDay: 3,
          },
        ],
      },
      new Date('2026-11-05T09:00:00Z'),
    );
    await repo.flush();

    const restarted = await open(store);
    expect(restarted.recordOf(FLORENCE_ID).encounters).toHaveLength(before + 1);
  });

  it("n'écrit que ce qui a changé", async () => {
    const store = new FakeStore();
    const repo = await open(store);
    const writesAfterSeed = store.writes;
    repo.update(FLORENCE_ID, { givenName: 'Flo' }, 1);
    await repo.flush();
    expect(store.writes).toBe(writesAfterSeed + 1);
    expect(repo.lastWriteSize).toBe(1);
  });

  it('base injoignable : le dépôt continue, les changements partent au retour', async () => {
    const store = new FakeStore();
    const repo = await open(store);
    store.fail = true;
    repo.update(FLORENCE_ID, { givenName: 'Flo' }, 1);
    await repo.flush();
    store.fail = false;
    repo.update(FLORENCE_ID, { familyName: 'Ngo' }, 2);
    await repo.flush();

    const restarted = await open(store);
    expect(restarted.findById(FLORENCE_ID)).toMatchObject({ givenName: 'Flo', familyName: 'Ngo' });
  });
});
