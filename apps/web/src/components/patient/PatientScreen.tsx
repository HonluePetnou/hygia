'use client';

import { observer } from 'mobx-react-lite';
import { PatientRecordViewModel } from '@hygia/view-models';
import { useGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';
import { useViewModel } from '@/lib/use-view-model';
import { AccessDenied } from './AccessDenied';
import { PatientHeader } from './PatientHeader';
import { SideColumn } from './SideColumn';
import { SummaryPanel } from './SummaryPanel';
import { Timeline } from './Timeline';

/** Écran « Dossier patient — chronologie et résumé IA » (maquette 04). */
export const PatientScreen = observer(function PatientScreen({ patientId }: { patientId: string }) {
  const session = useSession();
  const gateway = useGateway();
  const vm = useViewModel(
    () => new PatientRecordViewModel(gateway, session),
    (model) => void model.load(patientId),
    (model) => model.dispose(),
  );

  if (vm.state === 'forbidden') return <AccessDenied vm={vm} />;
  if (vm.state === 'error') return <p role="alert">{vm.errorMessage}</p>;
  if (vm.state !== 'ready' || !vm.overview) return <p>{session.t('state.loading')}</p>;

  return (
    <>
      <PatientHeader vm={vm} />
      <div className="record-grid">
        <SummaryPanel vm={vm} />
        <Timeline vm={vm} />
        <SideColumn overview={vm.overview} />
      </div>
    </>
  );
});
