'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { reaction } from 'mobx';
import { SessionViewModel } from '@hygia/view-models';

const SessionContext = createContext<SessionViewModel | null>(null);

export interface SessionProviderProps {
  children: ReactNode;
  /** Vue-modèle fournie de l'extérieur (tests) ; sinon une session neuve est créée. */
  session?: SessionViewModel;
}

/** Fournit la session unique de l'application et reporte la langue sur `<html lang>`. */
export function SessionProvider({ children, session }: SessionProviderProps) {
  const [value] = useState(() => session ?? new SessionViewModel());
  useEffect(
    () =>
      reaction(
        () => value.locale,
        (locale) => {
          document.documentElement.lang = locale;
        },
        { fireImmediately: true },
      ),
    [value],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Session courante ; échoue hors d'un `SessionProvider`. */
export function useSession(): SessionViewModel {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession doit être utilisé dans un SessionProvider');
  return session;
}
