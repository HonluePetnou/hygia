import { createServer } from 'node:http';
import { remoteVerifier } from '@hygia/auth';
import { AuditApi } from './audit-api.js';
import { AuditLog } from './audit-log.js';
import { InMemoryAuditStore } from './audit-store.js';
import { ChainVerifier } from './chain-verifier.js';
import { loadAuditEnv } from './config.js';
import { seedDemoEntries } from './seed.js';

const env = loadAuditEnv();
const now = () => new Date();
const log = new AuditLog(new InMemoryAuditStore(), undefined, now);
if (env.seed) seedDemoEntries(log);

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
