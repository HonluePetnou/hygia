'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { observer } from 'mobx-react-lite';
import { useSession } from '@/lib/session-context';

/** Le portail exige une session vérifiée de rôle patient ; les autres rôles retournent à l'accueil. */
export const PortalGuard = observer(function PortalGuard({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const allowed = session.isAuthenticated && session.role === 'patient';

  useEffect(() => {
    if (!session.isAuthenticated) router.replace('/connexion');
    else if (session.role !== 'patient') router.replace('/');
  }, [session.isAuthenticated, session.role, router]);

  return allowed ? <>{children}</> : null;
});
