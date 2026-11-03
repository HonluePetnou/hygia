'use client';

import { observer } from 'mobx-react-lite';
import { EpidemiologyViewModel } from '@hygia/view-models';
import { Badge } from '@/components/ui';
import { useEpidemiologyGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';
import { useViewModel } from '@/lib/use-view-model';
import { DistrictList } from './DistrictList';
import { Filters } from './Filters';
import { OutbreakCard } from './OutbreakCard';
import { OutbreakMap } from './OutbreakMap';
import { SeriesChart } from './SeriesChart';

/** Écran « Veille épidémiologique » (maquette 08), réservé au profil analyste. */
export const EpidemiologyScreen = observer(function EpidemiologyScreen() {
  const session = useSession();
  const gateway = useEpidemiologyGateway();
  const vm = useViewModel(
    () => new EpidemiologyViewModel(gateway),
    (model) => void model.load(),
    (model) => model.dispose(),
  );
  const { t } = session;
  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t('epidemiology.title')}</h1>
          <p className="muted">{t('epidemiology.subtitle')}</p>
        </div>
        <Badge tone="success">{t('epidemiology.pseudonymized')}</Badge>
      </header>
      <Filters vm={vm} />
      {vm.state === 'forbidden' ? <p role="alert">{t('epidemiology.forbidden')}</p> : null}
      {vm.state === 'error' ? <p role="alert">{t('epidemiology.error')}</p> : null}
      {vm.state === 'idle' || vm.state === 'loading' ? <p>{t('state.loading')}</p> : null}
      {vm.state === 'ready' ? (
        <div className="epi-layout">
          <OutbreakMap vm={vm} />
          <div className="epi-side">
            <OutbreakCard vm={vm} />
            <SeriesChart vm={vm} />
            <DistrictList vm={vm} />
          </div>
        </div>
      ) : null}
      <p className="muted epi-footer">{t('epidemiology.footer')}</p>
    </>
  );
});
