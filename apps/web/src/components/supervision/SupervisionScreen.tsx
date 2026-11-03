'use client';

import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Activity, X } from 'lucide-react';
import { SUPERVISED_SERVICES, SupervisionViewModel } from '@hygia/view-models';
import { Badge, Button } from '@/components/ui';
import { useSupervisionGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';
import { useViewModel } from '@/lib/use-view-model';
import { ExperimentList } from './ExperimentList';
import { LatencyPanel } from './LatencyPanel';
import { ServiceGrid } from './ServiceGrid';

/** Relecture périodique de l'état (ms). */
const REFRESH_MS = 5000;

/** Écran « Supervision » (maquette 10), profil administrateur système. */
export const SupervisionScreen = observer(function SupervisionScreen() {
  const session = useSession();
  const gateway = useSupervisionGateway();
  const vm = useViewModel(
    () => new SupervisionViewModel(gateway, session),
    (model) => void model.load(),
  );
  useEffect(() => {
    const timer = setInterval(() => void vm.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [vm]);
  const { t } = session;
  const banner = vm.banner;
  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t('supervision.title')}</h1>
          <p className="muted">{t('supervision.subtitle', { count: SUPERVISED_SERVICES.length, zones: 2 })}</p>
        </div>
        {banner === null ? null : <Badge tone="warning">{t('supervision.exerciseBadge')}</Badge>}
      </header>
      {vm.state === 'forbidden' ? <p role="alert">{t('supervision.forbidden')}</p> : null}
      {vm.state === 'error' ? <p role="alert">{t('supervision.error')}</p> : null}
      {vm.actionFailed ? <p role="alert">{t('supervision.action.error')}</p> : null}
      {vm.state === 'idle' || vm.state === 'loading' ? <p>{t('state.loading')}</p> : null}
      {vm.state === 'ready' ? (
        <>
          {banner === null ? null : (
            <section className="supervision-banner" role="status" aria-label={banner.title}>
              <Activity size={20} aria-hidden="true" />
              <div>
                <strong>{banner.title}</strong>
                <p>{banner.detail}</p>
              </div>
              <Button variant="ghost" disabled={vm.busy !== null} onClick={() => void vm.stopExercise()}>
                <X size={16} aria-hidden="true" /> {t('supervision.stopExercise')}
              </Button>
            </section>
          )}
          <ServiceGrid vm={vm} />
          <div className="supervision-bottom">
            <LatencyPanel vm={vm} />
            <ExperimentList vm={vm} />
          </div>
        </>
      ) : null}
    </>
  );
});
