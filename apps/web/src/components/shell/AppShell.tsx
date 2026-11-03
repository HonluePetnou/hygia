'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { observer } from 'mobx-react-lite';
import { useSession } from '@/lib/session-context';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/** Mise en page authentifiée ; renvoie vers `/connexion` sans session vérifiée. */
export const AppShell = observer(function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!session.isAuthenticated) router.replace('/connexion');
  }, [session.isAuthenticated, router]);

  if (!session.isAuthenticated) return null;
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
