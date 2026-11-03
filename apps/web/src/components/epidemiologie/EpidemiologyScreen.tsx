'use client';

import { Download } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { EpidemiologyViewModel } from '@hygia/view-models';
import { Badge, Button } from '@/components/ui';
import { downloadFile } from '@/lib/download-file';
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
        <div className="page-actions">
          <Badge tone="success">{t('epidemiology.pseudonymized')}</Badge>
          <Button
            variant="secondary"
            disabled={vm.state !== 'ready'}
            onClick={() =>
              void vm.exportReport(session.locale).then((file) => {
                if (file !== null) downloadFile(file);
              })
            }
          >
            <Download size={16} aria-hidden="true" /> {t('epidemiology.exportReport')}
          </Button>
        </div>
      </header>
      {vm.exportFailed ? <p role="alert">{t('export.error')}</p> : null}
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
