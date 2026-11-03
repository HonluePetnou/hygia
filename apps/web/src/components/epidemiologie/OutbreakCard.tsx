'use client';

import { TriangleAlert, Send } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { EpidemiologyViewModel } from '@hygia/view-models';
import { Button, Card } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Colonne droite, « Foyer anormal détecté » et bouton de notification de la délégation. */
export const OutbreakCard = observer(function OutbreakCard({ vm }: { vm: EpidemiologyViewModel }) {
  const { t } = useSession();
  const focus = vm.focus;
  if (focus === null) {
    return (
      <Card>
        <p className="muted">{t('epidemiology.outbreak.none')}</p>
      </Card>
    );
  }
  return (
    <Card className="epi-alert-card">
      <h2>
        <TriangleAlert size={18} aria-hidden="true" /> {t('epidemiology.outbreak.title')}
      </h2>
      <p>
        {t('epidemiology.outbreak.text', {
          pathology: t(`epidemiology.pathology.${focus.pathology}`),
          district: focus.district,
          cases: focus.cases,
          expected: focus.expected,
          threshold: focus.threshold,
        })}
      </p>
      <Button type="button" disabled={vm.notified} onClick={() => void vm.notifyDelegation()}>
        <Send size={16} aria-hidden="true" />{' '}
        {vm.notified ? t('epidemiology.outbreak.notified') : t('epidemiology.outbreak.notify')}
      </Button>
      {vm.notifyFailed ? <p role="alert">{t('epidemiology.outbreak.notifyError')}</p> : null}
    </Card>
  );
});
