import { FLORENCE_ID, demoDataset } from '@hygia/fhir';
import pg from 'pg';
import { PersistentPatientRepository } from '../src/persistence/persistent-patient-repository.js';
import { PrismaResourceStore } from '../src/persistence/prisma-resource-store.js';

// Test d'intégration : vraie base PostgreSQL, migrée (`pnpm --filter dossiers db:migrate`).
// Lancé seulement si DOSSIERS_TEST_DATABASE_URL est fournie ; la table est vidée au début.
const url = process.env['DOSSIERS_TEST_DATABASE_URL'];
const describeWithDb = url ? describe : describe.skip;

describeWithDb('persistance PostgreSQL (Prisma)', () => {
  const stores: PrismaResourceStore[] = [];
  const store = () => {
    const created = new PrismaResourceStore(url as string);
    stores.push(created);
    return created;
  };

  beforeAll(async () => {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query('TRUNCATE fhir_resource');
    await client.end();
  });

  afterAll(async () => {
    await Promise.all(stores.map((s) => s.close()));
  });

  it('remplit la base vide, puis une modification survit à un redémarrage du service', async () => {
    const repo = await PersistentPatientRepository.open(store(), demoDataset, { warn: () => undefined });
    expect(repo.update(FLORENCE_ID, { givenName: 'Flo' }, 1).status).toBe('saved');
    await repo.flush();

    const restarted = await PersistentPatientRepository.open(store(), demoDataset);
    expect(restarted.findById(FLORENCE_ID)).toMatchObject({ givenName: 'Flo', version: 2 });
    expect(restarted.recordOf(FLORENCE_ID).documents.length).toBeGreaterThan(0);
  });
});
