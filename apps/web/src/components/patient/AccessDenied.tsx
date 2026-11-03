'use client';

import { ShieldOff, Zap } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { PatientRecordViewModel } from '@hygia/view-models';
import { Button, Card } from '@/components/ui';
import { useSession } from '@/lib/session-context';
import { BreakGlassDialog } from './BreakGlassDialog';

/** Écran « Accès refusé » avec accès d'urgence (bris de glace). */
export const AccessDenied = observer(function AccessDenied({
  vm,
}: {
  vm: PatientRecordViewModel;
}) {
  const { t } = useSession();
  return (
    <Card className="access-denied">
      <ShieldOff size={32} aria-hidden="true" />
      <h1>{t('access.denied.title')}</h1>
      <p>{t('access.denied.text')}</p>
      <Button variant="danger" onClick={vm.breakGlass.open}>
        <Zap size={16} aria-hidden="true" />
        {t('access.emergency')}
      </Button>
      <BreakGlassDialog vm={vm.breakGlass} />
    </Card>
  );
});
