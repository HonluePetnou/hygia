import { InMemoryAuditStore, type AuditStore } from './audit-store.js';
import { S3ObjectLockAuditStore, type S3ObjectLockOperations } from './s3-audit-store.js';

/**
 * Journal WORM sur S3 si configuré et joignable ; sinon en mémoire. Un S3 injoignable (bucket
 * absent, LocalStack arrêté) ne doit pas empêcher le service de démarrer : avant, Audit plantait
 * et `pnpm demo` arrêtait toute la démo avec lui.
 */
export async function openAuditStore(
  s3: S3ObjectLockOperations | undefined,
  now: () => Date = () => new Date(),
  warn: (message: string) => void = (message) => console.warn(message),
): Promise<{ store: AuditStore; durable: boolean }> {
  if (s3 === undefined) return { store: new InMemoryAuditStore(), durable: false };
  try {
    return { store: await S3ObjectLockAuditStore.open(s3, now), durable: true };
  } catch (error) {
    const reason = error instanceof Error ? `${error.name} : ${error.message}` : String(error);
    warn(`[audit] journal S3 injoignable (${reason}) : journal en mémoire, non durable.`);
    return { store: new InMemoryAuditStore(), durable: false };
  }
}
