'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { CopiloteGateway, IngestionGateway, PatientsGateway } from '@hygia/view-models';
import { createCopiloteGateway, createPatientsGateway, type GatewayEnv } from './gateway-factory';
import { ApiIngestionGateway } from './ingestion-api';
import { useSession } from './session-context';

interface Gateways {
  patients: PatientsGateway;
  copilote: CopiloteGateway;
  ingestion: IngestionGateway;
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
}

/** Fournit les dépôts (patients, copilote, ingestion) à tout l'arbre authentifié. */
export function GatewayProvider({ children, gateway, copilote, ingestion }: GatewayProviderProps) {
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

/** Ingestion courante ; échoue hors d'un `GatewayProvider`. */
export function useIngestionGateway(): IngestionGateway {
  return useGateways().ingestion;
}
