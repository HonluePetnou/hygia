import { FLORENCE_ID, NANA_ID } from '@hygia/fhir';
import type { Role } from '@hygia/types';
import type { PasswordHasher } from '../security/password-hasher.js';
import type { Account } from './account.js';

/** Mot de passe commun des comptes de démonstration (données fictives). */
export const DEMO_PASSWORD = 'Hygia-demo-2026';

/**
 * Secret TOTP commun des comptes de démonstration. À saisir dans une application
 * d'authentification, ou à calculer avec `pnpm --filter identite code`.
 */
export const DEMO_TOTP_SECRET = 'KRUGKIDROVUWG2ZAMJZG653OEBTYQSZY';

/** Codes de secours de démonstration (usage unique, par compte). */
export const DEMO_BACKUP_CODES = ['DEMO-0001', 'DEMO-0002', 'DEMO-0003'];

interface DemoSeed {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

/** UUID déterministe de la famille `prefix` (même forme que les identifiants du jeu FHIR). */
const demoId = (prefix: number, index: number): string =>
  `00000000-0000-4000-8000-${prefix.toString(16).padStart(2, '0')}${index.toString(16).padStart(10, '0')}`;
/** Praticiens du jeu FHIR (préfixe 0x02). */
const practitioner = (n: number): string => demoId(0x02, n);

/** Un compte par rôle, plus un second médecin (hors équipe de soins) pour les démonstrations. */
export const DEMO_SEEDS: DemoSeed[] = [
  { id: NANA_ID, email: 'aicha.nana@hd-bonassama.cm', displayName: 'Dr Aïcha Nana', role: 'medecin' },
  { id: practitioner(2), email: 'rose.mballa@hd-bonassama.cm', displayName: 'Rose Mballa', role: 'infirmier' },
  { id: practitioner(5), email: 'marthe.eyenga@hd-bonassama.cm', displayName: 'Marthe Eyenga', role: 'administratif' },
  { id: demoId(0x20, 1), email: 'analyste@hygia.local', displayName: 'Nadège Analyste', role: 'analyste' },
  { id: FLORENCE_ID, email: 'florence.ngo@patient.hygia.local', displayName: 'Florence Ngo Bassa', role: 'patient' },
  { id: demoId(0x20, 2), email: 'admin@hygia.local', displayName: 'Administrateur système', role: 'admin' },
  { id: demoId(0x20, 3), email: 'dpo@hygia.local', displayName: 'DPO / Auditeur', role: 'auditeur' },
  { id: practitioner(3), email: 'paul.kamga@cma-bepanda.cm', displayName: 'Dr Paul Kamga', role: 'medecin' },
];

/** Construit les comptes de démonstration, secrets hachés, double authentification déjà enrôlée. */
export async function buildDemoAccounts(hasher: PasswordHasher): Promise<Account[]> {
  const passwordHash = await hasher.hash(DEMO_PASSWORD);
  const backupCodeHashes = await Promise.all(DEMO_BACKUP_CODES.map((code) => hasher.hash(code)));
  return DEMO_SEEDS.map((seed) => ({
    ...seed,
    version: 1,
    passwordHash,
    totpSecret: DEMO_TOTP_SECRET,
    backupCodeHashes: [...backupCodeHashes],
  }));
}
