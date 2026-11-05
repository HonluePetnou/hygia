import { createServer } from 'node:http';
import { remoteVerifier } from '@hygia/auth';
import { AuditApi } from './audit-api.js';
import { AuditLog } from './audit-log.js';
import { openAuditStore } from './open-store.js';
import { S3ClientObjectLockOperations, s3Client } from './s3-client-operations.js';
import { ChainVerifier } from './chain-verifier.js';
import { loadAuditEnv } from './config.js';
import { seedDemoEntries } from './seed.js';

const env = loadAuditEnv();
const now = () => new Date();
// AUDIT_S3_BUCKET : journal WORM sur S3 Object Lock (relu au démarrage) ; sinon, ou si S3 est
// injoignable, en mémoire.
const { store, durable } = await openAuditStore(
  env.s3 ? new S3ClientObjectLockOperations(s3Client(env.s3), env.s3.bucket) : undefined,
  now,
);
const log = new AuditLog(store, undefined, now);
if (durable && env.s3) {
  console.log(`[audit] journal WORM sur S3 (${env.s3.bucket}) : ${store.all().length} entrée(s)`);
}
// Entrées fictives seulement sur un journal vide : jamais de doublon dans un journal durable.
if (env.seed && store.all().length === 0) seedDemoEntries(log);

const chain = new ChainVerifier(
  log,
  {
    // Production : événement vers le service Notification (DPO). Ici, trace d'erreur.
    chainBroken: (brokenAt, checkedAt) =>
      console.error(`[audit] RUPTURE DE CHAÎNE à l'entrée ${brokenAt} (${checkedAt.toISOString()})`),
  },
  now,
);
chain.runNow();
setInterval(() => chain.tick(), env.tickMs).unref();

const api = new AuditApi({
  log,
  chain,
  now,
  verifier: remoteVerifier(env.jwksUrl),
  internalKey: env.internalKey,
  requestLog: (line) => console.log(JSON.stringify(line)),
});
createServer((req, res) => {
  res.setHeader('access-control-allow-origin', process.env['WEB_ORIGIN'] ?? 'http://localhost:3100');
  res.setHeader('access-control-allow-headers', 'authorization,content-type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }
  void api.handle(req, res);
}).listen(env.port, () => console.log(`[audit] à l'écoute sur le port ${env.port}`));
