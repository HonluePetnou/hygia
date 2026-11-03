'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { observer } from 'mobx-react-lite';
import { useSession } from '@/lib/session-context';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/** Mise en page authentifiée ; renvoie vers `/connexion` sans session vérifiée. */
export const AppShell = observer(function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  // L'analyste n'a accès qu'aux agrégats pseudonymisés : tout autre écran le ramène à la veille.
  const analystElsewhere = session.role === 'analyste' && !pathname.startsWith('/epidemiologie');

  useEffect(() => {
    if (!session.isAuthenticated) router.replace('/connexion');
  }, [session.isAuthenticated, router]);

  useEffect(() => {
    if (session.isAuthenticated && analystElsewhere) router.replace('/epidemiologie');
  }, [session.isAuthenticated, analystElsewhere, router]);

  if (!session.isAuthenticated || analystElsewhere) return null;
  return (
    <div className="shell">
      <Sidebar />
      <div className="shell-main">
        <Topbar />
        <main className="page">{children}</main>
      </div>
    </div>
  );
});
