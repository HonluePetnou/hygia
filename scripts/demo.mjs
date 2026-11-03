#!/usr/bin/env node
// Lance la démo HYGIA : infrastructure Docker si disponible, puis identité, dossiers, ia-clinique, audit,
// notification, synchronisation, agents (Python), broker et web.
import { spawn, spawnSync } from 'node:child_process';

// Mode hors ligne : connexion simulée (code fixe). Mode normal : service Identité (TOTP réel).
const OFFLINE_CODE = '481516';
const DEMO_EMAIL = 'aicha.nana@hd-bonassama.cm';
const DEMO_PASSWORD = 'Hygia-demo-2026';
const WEB_URL = 'http://localhost:3100';

/** Indique si Docker (daemon compris) est utilisable ; `DEMO_NO_DOCKER=1` force le mode hors ligne. */
function dockerAvailable() {
  if (process.env.DEMO_NO_DOCKER === '1') return false;
  return spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
}

const env = {
  ...process.env,
  // Registre de services du broker (équivalent local de Cloud Map) et adresse du broker pour le web.
  BROKER_SERVICE_DOSSIERS_URL: process.env.BROKER_SERVICE_DOSSIERS_URL ?? 'http://localhost:3001',
  BROKER_SERVICE_IDENTITE_URL: process.env.BROKER_SERVICE_IDENTITE_URL ?? 'http://localhost:3004',
  IDENTITE_JWKS_URL: process.env.IDENTITE_JWKS_URL ?? 'http://localhost:3004/.well-known/jwks.json',
  BROKER_SERVICE_IA_CLINIQUE_URL:
    process.env.BROKER_SERVICE_IA_CLINIQUE_URL ?? 'http://localhost:3003',
  BROKER_SERVICE_AUDIT_URL: process.env.BROKER_SERVICE_AUDIT_URL ?? 'http://localhost:3005',
  BROKER_SERVICE_AGENTS_URL: process.env.BROKER_SERVICE_AGENTS_URL ?? 'http://localhost:3007',
  BROKER_SERVICE_NOTIFICATION_URL:
    process.env.BROKER_SERVICE_NOTIFICATION_URL ?? 'http://localhost:3008',
  BROKER_SERVICE_SYNCHRONISATION_URL:
    process.env.BROKER_SERVICE_SYNCHRONISATION_URL ?? 'http://localhost:3009',
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
  // Jour des données fictives (consultation de Florence), le même que `DEMO_TODAY` du web.
  DOSSIERS_DATE_DEMO: process.env.DOSSIERS_DATE_DEMO ?? '2026-10-28',
};
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

// `DEMO_TWO_INSTANCES=1` : deuxième instance d'ia-clinique (port 3013, zone b) pour les expériences de
// pannes de `/supervision` (couper la zone a, le broker bascule sur la zone b). Les autres services
// gardent leur état en mémoire : une seule instance chacun.
const twoInstances = process.env.DEMO_TWO_INSTANCES === '1' && env.NEXT_PUBLIC_DEMO_OFFLINE !== '1';
if (twoInstances && process.env.BROKER_SERVICE_IA_CLINIQUE_URL === undefined) {
  env.BROKER_SERVICE_IA_CLINIQUE_URL = 'a=http://localhost:3003,b=http://localhost:3013';
}

const filters = [
  'identite',
  'dossiers',
  'ia-clinique',
  '@hygia/audit',
  'notification',
  'synchronisation',
  'broker',
  'web',
];
const children = filters.map((name) =>
  spawn('pnpm', ['--filter', name, 'dev'], { stdio: 'inherit', env }),
);

/** Interpréteur Python 3 disponible (`python3`, ou `python` sous Windows), sinon `undefined`. */
function findPython() {
  for (const command of ['python3', 'python']) {
    const probe = spawnSync(command, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0 && `${probe.stdout}${probe.stderr}`.includes('Python 3')) return command;
  }
  return undefined;
}

// Service Agents (Python, port 3007) : veille épidémiologique, pharmacovigilance, risque de réadmission.
const python = findPython();
if (python === undefined) {
  console.warn(
    'Python 3 introuvable : le service Agents ne démarre pas (carte épidémiologique et risque de réadmission indisponibles).',
  );
} else {
  children.push(
    spawn(python, ['-m', 'hygia_agents'], {
      stdio: 'inherit',
      cwd: 'services/agents',
      env: { ...env, PYTHONPATH: 'src' },
    }),
  );
}

if (twoInstances) {
  children.push(
    spawn('pnpm', ['--filter', 'ia-clinique', 'dev'], {
      stdio: 'inherit',
      env: { ...env, IA_CLINIQUE_PORT: '3013' },
    }),
  );
}

console.log(`\n  HYGIA est en cours de démarrage (quelques secondes).`);
console.log(`  URL à ouvrir : ${WEB_URL}`);
if (env.NEXT_PUBLIC_DEMO_OFFLINE === '1') {
  console.log(`  Mode hors ligne : tout mot de passe, code 2FA de démo : ${OFFLINE_CODE}\n`);
} else {
  console.log(`  Compte de démo : ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(
    '  Code 2FA (TOTP réel) : pnpm --filter identite code  (code de secours : DEMO-0001)\n',
  );
}

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
