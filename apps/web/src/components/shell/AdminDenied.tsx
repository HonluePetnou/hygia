'use client';

import { ShieldOff } from 'lucide-react';
import { Card } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** « Accès refusé » de l'administrateur système : aucun accès aux données de santé, sans bris de glace possible. */
export function AdminDenied() {
  const { t } = useSession();
  return (
    <Card className="access-denied" role="alert">
      <ShieldOff size={32} aria-hidden="true" />
      <h1>{t('access.denied.title')}</h1>
      <p>{t('access.denied.admin')}</p>
    </Card>
  );
}
