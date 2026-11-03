'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type {
  AuditGateway,
  CopiloteGateway,
  EpidemiologyGateway,
  IngestionGateway,
  PatientsGateway,
  SupervisionGateway,
} from '@hygia/view-models';
import {
  createAuditGateway,
  createCopiloteGateway,
  createEpidemiologyGateway,
  createPatientsGateway,
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

/** Supervision courante ; échoue hors d'un `GatewayProvider`. */
export function useSupervisionGateway(): SupervisionGateway {
  return useGateways().supervision;
}
