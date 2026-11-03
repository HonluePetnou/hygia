'use client';

import { observer } from 'mobx-react-lite';
import { AlertsViewModel } from '@hygia/view-models';
import { useGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';
import { useViewModel } from '@/lib/use-view-model';
import { AlertDetail } from './AlertDetail';
import { AlertList } from './AlertList';

/** Écran « Alertes IA » (maquette 07) : liste à gauche, raisonnement et décision à droite. */
export const AlertsScreen = observer(function AlertsScreen() {
  const session = useSession();
  const gateway = useGateway();
  const vm = useViewModel(
    () => new AlertsViewModel(gateway, session),
    (model) => void model.load(),
  );
  const { t } = session;
  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t('alerts.title')}</h1>
          <p className="muted">{t('alerts.subtitle')}</p>
        </div>
      </header>
      {vm.errorMessage ? <p role="alert">{vm.errorMessage}</p> : null}
      {vm.state === 'loading' || vm.state === 'idle' ? <p>{t('state.loading')}</p> : null}
      {vm.state === 'ready' ? (
        <div className="alerts-layout">
          <AlertList vm={vm} />
          <AlertDetail vm={vm} />
        </div>
      ) : null}
    </>
  );
});
