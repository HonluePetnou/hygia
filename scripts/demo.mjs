#!/usr/bin/env node
// Lance la démo HYGIA : infrastructure Docker si disponible, puis dossiers, ia-clinique et web.
import { spawn, spawnSync } from 'node:child_process';

const DEMO_CODE = '481516';
const WEB_URL = 'http://localhost:3100';

/** Indique si Docker (daemon compris) est utilisable ; `DEMO_NO_DOCKER=1` force le mode hors ligne. */
function dockerAvailable() {
  if (process.env.DEMO_NO_DOCKER === '1') return false;
  return spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
}

const env = { ...process.env };
if (dockerAvailable()) {
  console.log('Docker détecté : docker compose up -d');
  const up = spawnSync('docker', ['compose', 'up', '-d'], { stdio: 'inherit' });
  if (up.status !== 0) {
    console.warn('docker compose a échoué : bascule en mode hors ligne.');
    env.NEXT_PUBLIC_DEMO_OFFLINE = '1';
  }
} else {
  console.log('Docker indisponible : mode hors ligne (NEXT_PUBLIC_DEMO_OFFLINE=1).');
  env.NEXT_PUBLIC_DEMO_OFFLINE = '1';
}

const filters = ['dossiers', 'ia-clinique', 'web'];
const children = filters.map((name) =>
  spawn('pnpm', ['--filter', name, 'dev'], { stdio: 'inherit', env }),
);

console.log(`\n  HYGIA est en cours de démarrage (quelques secondes).`);
console.log(`  URL à ouvrir : ${WEB_URL}`);
console.log(`  Code 2FA de démo : ${DEMO_CODE}\n`);

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) {
  child.on('exit', (code) => {
    if (!stopping && code) console.error(`Un processus s'est arrêté (code ${code}).`);
    stop();
  });
}
