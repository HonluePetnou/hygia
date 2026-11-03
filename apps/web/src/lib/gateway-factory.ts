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
  /** Adresse du broker, seul point d'entrée vers les services. */
  NEXT_PUBLIC_API_URL?: string | undefined;
  NEXT_PUBLIC_DEMO_OFFLINE?: string | undefined;
}

/** Date du jour des données de démonstration (jour de la consultation fictive de Florence). */
export const DEMO_TODAY = '2026-10-28';

const DEFAULT_API_URL = 'http://localhost:3000';

/** Adresse d'un service derrière le broker : `<broker>/api/<service>`. */
function serviceUrl(env: GatewayEnv, service: string): string {
  const base = (env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, '');
  return `${base}/api/${service}`;
}

/**
 * Choisit le dépôt des patients : en mémoire si `NEXT_PUBLIC_DEMO_OFFLINE=1`,
 * sinon HTTP vers les services Dossiers et IA clinique, par le broker.
 */
export function createPatientsGateway(env: GatewayEnv, identity: () => Identity): PatientsGateway {
  if (env.NEXT_PUBLIC_DEMO_OFFLINE === '1') {
    return new InMemoryPatientsGateway(demoDataset, () => DEMO_TODAY, identity);
  }
  return new HttpPatientsGateway(
    {
      dossiersUrl: serviceUrl(env, 'dossiers'),
      iaCliniqueUrl: serviceUrl(env, 'ia-clinique'),
    },
    identity,
  );
}

/** Choisit le copilote : en mémoire si `NEXT_PUBLIC_DEMO_OFFLINE=1`, sinon flux SSE du service IA (par le broker). */
export function createCopiloteGateway(env: GatewayEnv, identity: () => Identity): CopiloteGateway {
  if (env.NEXT_PUBLIC_DEMO_OFFLINE === '1') return new InMemoryCopiloteGateway(demoDataset);
  return new HttpCopiloteGateway(serviceUrl(env, 'ia-clinique'), identity);
}
