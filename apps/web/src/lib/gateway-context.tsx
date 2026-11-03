'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { PatientsGateway } from '@hygia/view-models';
import { createPatientsGateway } from './gateway-factory';
import { useSession } from './session-context';

const GatewayContext = createContext<PatientsGateway | null>(null);

export interface GatewayProviderProps {
  children: ReactNode;
  /** Dépôt fourni de l'extérieur (tests) ; sinon choisi d'après l'environnement. */
  gateway?: PatientsGateway;
}

/** Fournit le dépôt des patients (HTTP ou mémoire) à tout l'arbre authentifié. */
export function GatewayProvider({ children, gateway }: GatewayProviderProps) {
  const session = useSession();
  const [value] = useState(
    () =>
      gateway ??
      createPatientsGateway(
        {
          NEXT_PUBLIC_DOSSIERS_URL: process.env.NEXT_PUBLIC_DOSSIERS_URL,
          NEXT_PUBLIC_IA_URL: process.env.NEXT_PUBLIC_IA_URL,
          NEXT_PUBLIC_DEMO_OFFLINE: process.env.NEXT_PUBLIC_DEMO_OFFLINE,
        },
        () => session.identity,
      ),
  );
  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

/** Dépôt des patients courant ; échoue hors d'un `GatewayProvider`. */
export function useGateway(): PatientsGateway {
  const gateway = useContext(GatewayContext);
  if (!gateway) throw new Error('useGateway doit être utilisé dans un GatewayProvider');
  return gateway;
}
