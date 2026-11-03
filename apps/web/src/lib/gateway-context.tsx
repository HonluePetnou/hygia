'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type {
  AdministrationGateway,
  AuditGateway,
  CopiloteGateway,
  EpidemiologyGateway,
  IngestionGateway,
  PatientsGateway,
  PortalGateway,
  ReadmissionGateway,
  ScribeGateway,
  SupervisionGateway,
} from '@hygia/view-models';
import {
  createAdministrationGateway,
  createAuditGateway,
  createCopiloteGateway,
  createEpidemiologyGateway,
  createPatientsGateway,
  createPortalGateway,
  createReadmissionGateway,
  createScribeGateway,
  createSupervisionGateway,
  type GatewayEnv,
} from './gateway-factory';
import { ApiIngestionGateway } from './ingestion-api';
import { useSession } from './session-context';

interface Gateways {
  patients: PatientsGateway;
  copilote: CopiloteGateway;
  ingestion: IngestionGateway;
  epidemiology: EpidemiologyGateway;
  audit: AuditGateway;
  supervision: SupervisionGateway;
  administration: AdministrationGateway;
  portal: PortalGateway;
  scribe: ScribeGateway;
  readmission: ReadmissionGateway;
}

const GatewayContext = createContext<Gateways | null>(null);

export interface GatewayProviderProps {
  children: ReactNode;
  /** Dépôt des patients fourni de l'extérieur (tests) ; sinon choisi d'après l'environnement. */
  gateway?: PatientsGateway;
  /** Copilote fourni de l'extérieur (tests). */
  copilote?: CopiloteGateway;
  /** Ingestion fournie de l'extérieur (tests) ; sinon la route `/api/ingestion`. */
  ingestion?: IngestionGateway;
  /** Veille épidémiologique fournie de l'extérieur (tests). */
  epidemiology?: EpidemiologyGateway;
  /** Journal d'audit fourni de l'extérieur (tests). */
  audit?: AuditGateway;
  /** Supervision fournie de l'extérieur (tests). */
  supervision?: SupervisionGateway;
  /** Administration fournie de l'extérieur (tests). */
  administration?: AdministrationGateway;
  /** Portail patient fourni de l'extérieur (tests). */
  portal?: PortalGateway;
  /** Scribe de consultation fourni de l'extérieur (tests). */
  scribe?: ScribeGateway;
  /** Risque de réadmission fourni de l'extérieur (tests). */
  readmission?: ReadmissionGateway;
}

/** Fournit les dépôts (patients, copilote, ingestion) à tout l'arbre authentifié. */
export function GatewayProvider({
  children,
  gateway,
  copilote,
  ingestion,
  epidemiology,
  audit,
  supervision,
  administration,
  portal,
  scribe,
  readmission,
}: GatewayProviderProps) {
  const session = useSession();
  const [value] = useState<Gateways>(() => {
    const env: GatewayEnv = {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_DEMO_OFFLINE: process.env.NEXT_PUBLIC_DEMO_OFFLINE,
    };
    const identity = () => session.identity;
    return {
      patients: gateway ?? createPatientsGateway(env, identity, session.setToken),
      copilote: copilote ?? createCopiloteGateway(env, identity),
      ingestion: ingestion ?? new ApiIngestionGateway(),
      epidemiology: epidemiology ?? createEpidemiologyGateway(env, identity),
      audit: audit ?? createAuditGateway(env, identity),
      supervision: supervision ?? createSupervisionGateway(env, identity),
      administration: administration ?? createAdministrationGateway(env, identity),
      portal: portal ?? createPortalGateway(env, identity),
      scribe: scribe ?? createScribeGateway(env, identity),
      readmission: readmission ?? createReadmissionGateway(env, identity),
    };
  });
  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

function useGateways(): Gateways {
  const gateways = useContext(GatewayContext);
  if (!gateways) throw new Error('useGateway doit être utilisé dans un GatewayProvider');
  return gateways;
}

/** Dépôt des patients courant ; échoue hors d'un `GatewayProvider`. */
export function useGateway(): PatientsGateway {
  return useGateways().patients;
}

/** Copilote courant ; échoue hors d'un `GatewayProvider`. */
export function useCopiloteGateway(): CopiloteGateway {
  return useGateways().copilote;
}

/** Veille épidémiologique courante ; échoue hors d'un `GatewayProvider`. */
export function useEpidemiologyGateway(): EpidemiologyGateway {
  return useGateways().epidemiology;
}

/** Ingestion courante ; échoue hors d'un `GatewayProvider`. */
export function useIngestionGateway(): IngestionGateway {
  return useGateways().ingestion;
}

/** Journal d'audit courant ; échoue hors d'un `GatewayProvider`. */
export function useAuditGateway(): AuditGateway {
  return useGateways().audit;
}

/** Administration des comptes courante ; échoue hors d'un `GatewayProvider`. */
export function useAdministrationGateway(): AdministrationGateway {
  return useGateways().administration;
}

/** Supervision courante ; échoue hors d'un `GatewayProvider`. */
export function useSupervisionGateway(): SupervisionGateway {
  return useGateways().supervision;
}

/** Scribe de consultation courant ; échoue hors d'un `GatewayProvider`. */
export function useScribeGateway(): ScribeGateway {
  return useGateways().scribe;
}

/** Estimation du risque de réadmission courante ; échoue hors d'un `GatewayProvider`. */
export function useReadmissionGateway(): ReadmissionGateway {
  return useGateways().readmission;
}

/** Portail patient courant ; échoue hors d'un `GatewayProvider`. */
export function usePortalGateway(): PortalGateway {
  return useGateways().portal;
}
