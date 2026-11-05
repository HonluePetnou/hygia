import { describe, expect, it, vi } from 'vitest';
import { InMemoryAuditStore } from '../src/audit-store.js';
import { openAuditStore } from '../src/open-store.js';
import { S3ObjectLockAuditStore, type S3ObjectLockOperations } from '../src/s3-audit-store.js';

const reachable: S3ObjectLockOperations = {
  putLocked: async () => undefined,
  list: async () => [],
  getObject: async () => '{}',
};

describe("ouverture du journal d'audit", () => {
  it('sans S3 configuré : journal en mémoire', async () => {
    const { store, durable } = await openAuditStore(undefined);
    expect(store).toBeInstanceOf(InMemoryAuditStore);
    expect(durable).toBe(false);
  });

  it('S3 joignable : journal WORM sur S3', async () => {
    const { store, durable } = await openAuditStore(reachable);
    expect(store).toBeInstanceOf(S3ObjectLockAuditStore);
    expect(durable).toBe(true);
  });

  it('S3 injoignable ou bucket absent : le service démarre quand même, en mémoire, avec un avertissement', async () => {
    const warn = vi.fn();
    const missingBucket: S3ObjectLockOperations = {
      ...reachable,
      list: async () => {
        throw Object.assign(new Error('The specified bucket does not exist'), { name: 'NoSuchBucket' });
      },
    };
    const { store, durable } = await openAuditStore(missingBucket, () => new Date(), warn);
    expect(store).toBeInstanceOf(InMemoryAuditStore);
    expect(durable).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NoSuchBucket'));
  });
});
