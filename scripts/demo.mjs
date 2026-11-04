#!/usr/bin/env node
// Lance la démo HYGIA : infrastructure Docker si disponible, puis identité, dossiers, ia-clinique, audit,
// notification, synchronisation, agents (Python), broker et web.
import { spawn, spawnSync } from 'node:child_process';

// Mode hors ligne : connexion simulée (code fixe). Mode normal : service Identité (TOTP réel).
const OFFLINE_CODE = '481516';
const DEMO_EMAIL = 'aicha.nana@hd-bonassama.cm';
const DEMO_PASSWORD = 'Hygia-demo-2026';
const WEB_URL = 'http://localhost:3100';

/** Indique si Docker (daemon compris) est utilisable. */
function dockerAvailable() {
  return spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
}

// `DEMO_MODE=services` force le mode réparti, `DEMO_MODE=offline` (ou `DEMO_NO_DOCKER=1`) le mode hors
// ligne. Sans précision : mode services. Les services gardent leurs données en mémoire et n'ont pas
// besoin de Docker (PostgreSQL et LocalStack ne sont lus par aucun service pour l'instant).
const demoMode =
  process.env.DEMO_MODE === 'offline' || process.env.DEMO_NO_DOCKER === '1' ? 'offline' : 'services';
if (process.env.DEMO_MODE !== undefined && !['services', 'offline'].includes(process.env.DEMO_MODE)) {
  console.error(`DEMO_MODE inconnu : « ${process.env.DEMO_MODE} » (attendu : services ou offline).`);
  process.exit(1);
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
  // Journal d'audit réparti : Dossiers transmet chaque accès au service Audit (route interne à clé),
  // qui alimente `/audit` (DPO) et « Qui a vu mon dossier ? » (portail). Clé de démonstration.
  AUDIT_URL: process.env.AUDIT_URL ?? 'http://localhost:3005',
  AUDIT_INTERNAL_KEY: process.env.AUDIT_INTERNAL_KEY ?? 'demo-audit-key',
  // Journal vide au démarrage : il se remplit des accès réels de la démo (pas d'entrées fictives).
  AUDIT_SEED: process.env.AUDIT_SEED ?? '0',
  // Jour des données fictives (consultation de Florence), le même que `DEMO_TODAY` du web.
  DOSSIERS_DATE_DEMO: process.env.DOSSIERS_DATE_DEMO ?? '2026-10-28',
};
if (demoMode === 'offline') {
  console.log('Mode hors ligne demandé (NEXT_PUBLIC_DEMO_OFFLINE=1).');
  env.NEXT_PUBLIC_DEMO_OFFLINE = '1';
} else if (process.env.DEMO_INFRA !== '1') {
  console.log('Mode services (infrastructure Docker non lancée ; DEMO_INFRA=1 pour docker compose).');
} else if (dockerAvailable()) {
  console.log('DEMO_INFRA=1 : docker compose up -d');
  const up = spawnSync('docker', ['compose', 'up', '-d'], { stdio: 'inherit' });
  if (up.status !== 0) {
    console.warn('docker compose a échoué : la démo continue en mode services, sans infrastructure Docker.');
  }
} else {
  console.warn('DEMO_INFRA=1 mais Docker indisponible : la démo continue en mode services.');
}

// `DEMO_TWO_INSTANCES=1` : deuxième instance d'ia-clinique (port 3013, zone b) pour les expériences de
// pannes de `/supervision` (couper la zone a, le broker bascule sur la zone b). Les autres services
// gardent leur état en mémoire : une seule instance chacun.
const twoInstances = process.env.DEMO_TWO_INSTANCES === '1' && env.NEXT_PUBLIC_DEMO_OFFLINE !== '1';
if (twoInstances && process.env.BROKER_SERVICE_IA_CLINIQUE_URL === undefined) {
  env.BROKER_SERVICE_IA_CLINIQUE_URL = 'a=http://localhost:3003,b=http://localhost:3013';
}

// Sous Windows, `pnpm` est un script `.cmd` : Node ne peut le lancer qu'à travers un shell.
const shell = process.platform === 'win32';

// AWS simulé (DEMO_INFRA=1, LocalStack prêt) : journal d'audit WORM sur S3 Object Lock, versions
// des dossiers sur S3 versionné, baux du coordinateur des agents sur DynamoDB.
const localstack = spawnSync(
  'docker',
  ['inspect', '--format', '{{.State.Health.Status}}', 'hygia-localstack'],
  { encoding: 'utf8' },
);
if (env.NEXT_PUBLIC_DEMO_OFFLINE !== '1' && localstack.stdout?.trim() === 'healthy') {
  env.AWS_ENDPOINT_URL ??= 'http://localhost:4566';
  env.AWS_REGION ??= 'eu-west-3';
  env.AUDIT_S3_BUCKET ??= 'hygia-audit';
  env.DOSSIERS_S3_BUCKET ??= 'hygia-documents';
  env.AGENTS_DYNAMODB_URL ??= env.AWS_ENDPOINT_URL;
  console.log('LocalStack prêt : audit sur S3 Object Lock, versions sur S3, baux sur DynamoDB.');
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

// Les dépendances internes (`@hygia/auth`, `@hygia/ingestion`…) exposent `dist/` : sur un dépôt
// fraîchement cloné, rien n'est compilé et les services échouent (« Cannot find module »).
// `<service>^...` = toutes ses dépendances internes, sans lui-même ; turbo garde un cache.
console.log('Compilation des dépendances internes des services…');
const build = spawnSync(
  'pnpm',
  ['turbo', 'run', 'build', ...filters.map((name) => `--filter=${name}^...`)],
  { stdio: 'inherit', shell },
);
if (build.status !== 0) {
  console.error('La compilation des dépendances internes a échoué : démo arrêtée.');
  process.exit(build.status ?? 1);
}
const children = filters.map((name) =>
  spawn('pnpm', ['--filter', name, 'dev'], { stdio: 'inherit', env, shell }),
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
      shell,
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
  for (const child of children) {
    if (child.exitCode !== null || child.pid === undefined) continue;
    // Sous Windows, `kill` n'arrête que le shell : `taskkill /T` arrête aussi les processus enfants
    // (sinon `next dev` et les services restent sur leurs ports, EADDRINUSE au lancement suivant).
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) {
  child.on('exit', (code) => {
    if (!stopping && code) console.error(`Un processus s'est arrêté (code ${code}).`);
    stop();
  });
}
