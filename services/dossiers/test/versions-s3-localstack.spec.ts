import { randomUUID } from 'node:crypto';
import { S3ClientOperations } from '../src/versions/s3-client-operations.js';
import { S3DocumentStore } from '../src/versions/s3-document-store.js';

// Intégration : LocalStack démarré (bucket versionné `hygia-documents`, infra/localstack/init.sh).
// Ignoré sans HYGIA_LOCALSTACK_URL.
const endpoint = process.env['HYGIA_LOCALSTACK_URL'];
const describeWithLocalStack = endpoint ? describe : describe.skip;

describeWithLocalStack('versions des ressources sur S3 versionné (LocalStack)', () => {
  it('chaque modification est une version S3 immuable, relue dans l’ordre', async () => {
    const store = new S3DocumentStore(
      new S3ClientOperations({ bucket: 'hygia-documents', region: 'eu-west-3', endpoint: endpoint as string }),
    );
    const resourceId = randomUUID();
    const patientId = randomUUID();
    const version = (number: number, givenName: string) => ({
      resourceId,
      resourceType: 'Patient' as const,
      patientId,
      number,
      author: 'test',
      createdAt: new Date(Date.UTC(2026, 10, 5, 9, number)).toISOString(),
      reason: `version ${number}`,
      content: { id: resourceId, version: number, givenName },
    });

    await store.append(version(1, 'Florence'));
    await store.append(version(2, 'Flo'));
    await expect(store.append(version(2, 'Doublon'))).rejects.toThrow(/déjà enregistrée/);

    const versions = await store.list(resourceId);
    expect(versions.map((v) => [v.number, v.content['givenName']])).toEqual([
      [1, 'Florence'],
      [2, 'Flo'],
    ]);
    expect((await store.get(resourceId, 1))?.content['givenName']).toBe('Florence');
    expect((await store.listForPatient(patientId)).map((v) => v.number)).toEqual([2, 1]);
  });
});
