'use client';

import { useEffect, useRef, type ReactNode } from 'react';
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
  const adminDenied =
    isAdmin && !adminHome && !ADMIN_PATHS.some((path) => pathname.startsWith(path));
  // Le patient n'a que son portail : tout écran du personnel soignant le ramène à `/portail`.
  const patientElsewhere = session.role === 'patient';
  const redirectTo = patientElsewhere
    ? '/portail'
    : analystElsewhere
      ? '/epidemiologie'
      : auditorElsewhere
        ? '/audit'
        : adminHome
          ? '/administration'
          : null;

  // Une session a-t-elle existé dans cette page ? Si oui, son absence vient d'une déconnexion.
  const hadSession = useRef(session.isAuthenticated);
  if (session.isAuthenticated) hadSession.current = true;

  useEffect(() => {
    // La session vit dans la page : un lien direct (ou un rechargement) passe par la connexion, qui
    // ramène ensuite à la page demandée (`suite`). Après une déconnexion, le compte suivant ne doit
    // pas atterrir sur la page du précédent : retour simple à la connexion.
    if (!session.isAuthenticated) {
      router.replace(
        hadSession.current || pathname === '/'
          ? '/connexion'
          : `/connexion?suite=${encodeURIComponent(pathname)}`,
      );
    }
  }, [session.isAuthenticated, pathname, router]);

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
