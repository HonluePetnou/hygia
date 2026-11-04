import { DeleteObjectCommand, GetObjectRetentionCommand, ListObjectVersionsCommand } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import { AuditLog } from '../src/audit-log.js';
import { S3ObjectLockAuditStore, eventKey } from '../src/s3-audit-store.js';
import { S3ClientObjectLockOperations, s3Client } from '../src/s3-client-operations.js';

// Intégration : LocalStack démarré (`docker compose up -d localstack`, bucket `hygia-audit`
// créé avec Object Lock par infra/localstack/init.sh). Ignoré sans HYGIA_LOCALSTACK_URL.
const endpoint = process.env['HYGIA_LOCALSTACK_URL'];
const target = { bucket: 'hygia-audit', region: 'eu-west-3', ...(endpoint ? { endpoint } : {}) };

describe.skipIf(!endpoint)("journal d'audit WORM sur S3 (LocalStack)", () => {
  it('écrit chaque entrée verrouillée en mode conformité et la relit au redémarrage', async () => {
    const client = s3Client(target);
    const operations = new S3ClientObjectLockOperations(client, target.bucket);
    const store = await S3ObjectLockAuditStore.open(operations);
    const before = store.all().length;
    const log = new AuditLog(store);
    const event = log.append({
      actor: 'Dr Paul Kamga',
      role: 'medecin',
      action: 'bris_de_glace',
      resourceType: 'Patient',
      resourceId: 'p-test',
      patientId: 'p-test',
      reason: 'Test d’intégration',
    });
    await store.flush();

    const restarted = await S3ObjectLockAuditStore.open(operations);
    expect(restarted.all()).toHaveLength(before + 1);
    expect(new AuditLog(restarted).verify()).toEqual({ intact: true });

    const key = eventKey(event.index);
    const retention = await client.send(new GetObjectRetentionCommand({ Bucket: target.bucket, Key: key }));
    expect(retention.Retention?.Mode).toBe('COMPLIANCE');

    // WORM : la version verrouillée ne peut pas être supprimée.
    const versions = await client.send(new ListObjectVersionsCommand({ Bucket: target.bucket, Prefix: key }));
    const versionId = versions.Versions?.[0]?.VersionId;
    await expect(
      client.send(new DeleteObjectCommand({ Bucket: target.bucket, Key: key, VersionId: versionId })),
    ).rejects.toThrow();
  });
});
