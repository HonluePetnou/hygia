'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { observer } from 'mobx-react-lite';
import { useSession } from '@/lib/session-context';
import { AdminDenied } from './AdminDenied';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/** Écrans accessibles à l'administrateur système. */
const ADMIN_PATHS = ['/administration', '/supervision'];

/** Mise en page authentifiée ; renvoie vers `/connexion` sans session vérifiée. */
export const AppShell = observer(function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  // L'analyste n'a accès qu'aux agrégats pseudonymisés : tout autre écran le ramène à la veille.
  const analystElsewhere = session.role === 'analyste' && !pathname.startsWith('/epidemiologie');
  // L'auditeur n'a que la section Conformité : tout autre écran le ramène au journal.
  const auditorElsewhere = session.role === 'auditeur' && !pathname.startsWith('/audit');
  // L'administrateur système n'a que Conformité (comptes, supervision) : l'accueil l'y ramène,
  // et tout autre écran (dont un lien direct vers un dossier patient) affiche « Accès refusé ».
  const isAdmin = session.role === 'admin';
  const adminHome = isAdmin && pathname === '/';
  const adminDenied = isAdmin && !adminHome && !ADMIN_PATHS.some((path) => pathname.startsWith(path));
  const redirectTo = analystElsewhere
    ? '/epidemiologie'
    : auditorElsewhere
      ? '/audit'
      : adminHome
        ? '/administration'
        : null;

  useEffect(() => {
    if (!session.isAuthenticated) router.replace('/connexion');
  }, [session.isAuthenticated, router]);

  useEffect(() => {
    if (session.isAuthenticated && redirectTo !== null) router.replace(redirectTo);
  }, [session.isAuthenticated, redirectTo, router]);

  if (!session.isAuthenticated || redirectTo !== null) return null;
  return (
    <div className="shell">
      <Sidebar />
      <div className="shell-main">
        <Topbar />
        <main className="page">{adminDenied ? <AdminDenied /> : children}</main>
      </div>
    </div>
  );
});
