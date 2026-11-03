'use client';

import { observer } from 'mobx-react-lite';
import { IngestionViewModel } from '@hygia/view-models';
import { useGateway, useIngestionGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';
import { useViewModel } from '@/lib/use-view-model';
import { ChainPanel } from './ChainPanel';
import { ChannelCards } from './ChannelCards';
import { DropZone } from './DropZone';
import { EntitiesTable } from './EntitiesTable';
import { PatientAttach } from './PatientAttach';

/** Écran « Importer un document — chaîne d'analyse » (maquette 06). */
export const ImportScreen = observer(function ImportScreen() {
  const session = useSession();
  const ingestion = useIngestionGateway();
  const patients = useGateway();
  const vm = useViewModel(
    () => new IngestionViewModel(ingestion, session, patients),
    (model) => void model.loadPatients(),
  );

  return (
    <>
      <header>
        <h1>{vm.title}</h1>
        <p className="muted">{session.t('import.subtitle')}</p>
      </header>
      <div className="import-grid">
        <div className="import-left">
          <DropZone vm={vm} />
          <PatientAttach vm={vm} />
          <ChannelCards vm={vm} />
        </div>
        <ChainPanel vm={vm} />
      </div>
      <EntitiesTable vm={vm} />
    </>
  );
});
