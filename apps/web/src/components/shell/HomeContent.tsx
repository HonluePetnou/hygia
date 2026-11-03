'use client';

import { observer } from 'mobx-react-lite';
import { Card } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Contenu provisoire de l'accueil, remplacé par le tableau de bord (tâche suivante). */
export const HomeContent = observer(function HomeContent() {
  const { t } = useSession();
  return (
    <>
      <h1>{t('dashboard.title')}</h1>
      <Card>
        <h2>{t('nav.home')}</h2>
      </Card>
    </>
  );
});
