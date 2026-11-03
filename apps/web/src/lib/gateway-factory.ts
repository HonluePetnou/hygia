import { demoDataset } from '@hygia/fhir';
import {
  HttpAdministrationGateway,
  InMemoryAdministrationGateway,
  type AdministrationGateway,
  HttpAuditGateway,
  HttpAuthGateway,
  HttpCopiloteGateway,
  HttpEpidemiologyGateway,
  HttpPatientsGateway,
  HttpSupervisionGateway,
  InMemoryAuditGateway,
  InMemoryCopiloteGateway,
  InMemoryEpidemiologyGateway,
  InMemoryPatientsGateway,
  InMemorySupervisionGateway,
  type AuditGateway,
  type AuthGateway,
  type CopiloteGateway,
  type EpidemiologyGateway,
  type Identity,
  type PatientsGateway,
  type SupervisionGateway,
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
export function createPatientsGateway(
  env: GatewayEnv,
  identity: () => Identity,
  onToken?: (token: string) => void,
): PatientsGateway {
  if (env.NEXT_PUBLIC_DEMO_OFFLINE === '1') {
    return new InMemoryPatientsGateway(demoDataset, () => DEMO_TODAY, identity);
  }
  return new HttpPatientsGateway(
    {
      dossiersUrl: serviceUrl(env, 'dossiers'),
      iaCliniqueUrl: serviceUrl(env, 'ia-clinique'),
      identiteUrl: serviceUrl(env, 'identite'),
    },
    identity,
    undefined,
    onToken,
  );
}

/**
 * Choisit la connexion : hors ligne (code fixe, aucun jeton réel) si `NEXT_PUBLIC_DEMO_OFFLINE=1`,
 * sinon le service Identité (par le broker).
 */
export function createAuthGateway(env: GatewayEnv): AuthGateway | undefined {
  if (env.NEXT_PUBLIC_DEMO_OFFLINE === '1') return undefined;
  return new HttpAuthGateway(serviceUrl(env, 'identite'));
}

/** Choisit la veille épidémiologique : en mémoire si `NEXT_PUBLIC_DEMO_OFFLINE=1`, sinon service Agents (par le broker). */
export function createEpidemiologyGateway(env: GatewayEnv, identity: () => Identity): EpidemiologyGateway {
  if (env.NEXT_PUBLIC_DEMO_OFFLINE === '1') return new InMemoryEpidemiologyGateway();
  return new HttpEpidemiologyGateway(serviceUrl(env, 'agents'), identity);
}

/** Choisit le copilote : en mémoire si `NEXT_PUBLIC_DEMO_OFFLINE=1`, sinon flux SSE du service IA (par le broker). */
export function createCopiloteGateway(env: GatewayEnv, identity: () => Identity): CopiloteGateway {
  if (env.NEXT_PUBLIC_DEMO_OFFLINE === '1') return new InMemoryCopiloteGateway(demoDataset);
  return new HttpCopiloteGateway(serviceUrl(env, 'ia-clinique'), identity);
}

/** Choisit le journal d'audit : en mémoire si `NEXT_PUBLIC_DEMO_OFFLINE=1`, sinon service Audit (par le broker). */
export function createAuditGateway(env: GatewayEnv, identity: () => Identity): AuditGateway {
  if (env.NEXT_PUBLIC_DEMO_OFFLINE === '1') return new InMemoryAuditGateway();
  return new HttpAuditGateway(serviceUrl(env, 'audit'), identity);
}

/** Choisit l'administration : en mémoire si `NEXT_PUBLIC_DEMO_OFFLINE=1`, sinon le service Identité (par le broker). */
export function createAdministrationGateway(env: GatewayEnv, identity: () => Identity): AdministrationGateway {
  if (env.NEXT_PUBLIC_DEMO_OFFLINE === '1') return new InMemoryAdministrationGateway();
  return new HttpAdministrationGateway(serviceUrl(env, 'identite'), identity);
}

/** Choisit la supervision : simulée si `NEXT_PUBLIC_DEMO_OFFLINE=1`, sinon les routes `/api/supervision` du broker (rôle admin). */
export function createSupervisionGateway(env: GatewayEnv, identity: () => Identity): SupervisionGateway {
  if (env.NEXT_PUBLIC_DEMO_OFFLINE === '1') return new InMemorySupervisionGateway();
  return new HttpSupervisionGateway(serviceUrl(env, 'supervision'), identity);
}
