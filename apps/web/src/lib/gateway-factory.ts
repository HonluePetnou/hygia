import { demoDataset } from '@hygia/fhir';
import {
  HttpCopiloteGateway,
  HttpPatientsGateway,
  InMemoryCopiloteGateway,
  InMemoryPatientsGateway,
  type CopiloteGateway,
  type Identity,
  type PatientsGateway,
} from '@hygia/view-models';

/** Variables publiques lues par le client (lues littéralement pour que Next.js les inline). */
export interface GatewayEnv {
  NEXT_PUBLIC_DOSSIERS_URL?: string | undefined;
  NEXT_PUBLIC_IA_URL?: string | undefined;
  NEXT_PUBLIC_DEMO_OFFLINE?: string | undefined;
}

/** Date du jour des données de démonstration (jour de la consultation fictive de Florence). */
export const DEMO_TODAY = '2026-10-28';

const DEFAULT_DOSSIERS_URL = 'http://localhost:3001';
const DEFAULT_IA_URL = 'http://localhost:3003';

/**
 * Choisit le dépôt des patients : en mémoire si `NEXT_PUBLIC_DEMO_OFFLINE=1`,
 * sinon HTTP vers les services Dossiers et IA clinique.
 */
export function createPatientsGateway(env: GatewayEnv, identity: () => Identity): PatientsGateway {
  if (env.NEXT_PUBLIC_DEMO_OFFLINE === '1') {
    return new InMemoryPatientsGateway(demoDataset, () => DEMO_TODAY, identity);
  }
  return new HttpPatientsGateway(
    {
      dossiersUrl: env.NEXT_PUBLIC_DOSSIERS_URL ?? DEFAULT_DOSSIERS_URL,
      iaCliniqueUrl: env.NEXT_PUBLIC_IA_URL ?? DEFAULT_IA_URL,
    },
    identity,
  );
}

/** Choisit le copilote : en mémoire si `NEXT_PUBLIC_DEMO_OFFLINE=1`, sinon flux SSE du service IA. */
export function createCopiloteGateway(env: GatewayEnv, identity: () => Identity): CopiloteGateway {
  if (env.NEXT_PUBLIC_DEMO_OFFLINE === '1') return new InMemoryCopiloteGateway(demoDataset);
  return new HttpCopiloteGateway(env.NEXT_PUBLIC_IA_URL ?? DEFAULT_IA_URL, identity);
}
