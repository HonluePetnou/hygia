'use client';

import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { PatientRecordViewModel, type AudioRecorder } from '@hygia/view-models';
import { useGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';
import { useViewModel } from '@/lib/use-view-model';
import { BrowserAudioRecorder } from '@/lib/browser-audio-recorder';
import { ScribePanel } from '@/components/scribe/ScribePanel';
import { AccessDenied } from './AccessDenied';
import { PatientHeader, type PatientTab } from './PatientHeader';
import { ReadmissionCard } from './ReadmissionCard';
import { SideColumn } from './SideColumn';
import { SummaryPanel } from './SummaryPanel';
import { Timeline } from './Timeline';
import { VersionsPanel } from './VersionsPanel';

const createBrowserRecorder = () => new BrowserAudioRecorder();

/** Écran « Dossier patient — chronologie et résumé IA » (maquette 04). */
export const PatientScreen = observer(function PatientScreen({
  patientId,
  createRecorder = createBrowserRecorder,
}: {
  patientId: string;
  /** Fabrique du micro (navigateur par défaut ; simulée dans les tests). */
  createRecorder?: () => AudioRecorder;
}) {
  const [tab, setTab] = useState<PatientTab>('timeline');
  const [dictating, setDictating] = useState(false);
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
      <PatientHeader vm={vm} tab={tab} onTab={setTab} onDictate={() => setDictating(true)} />
      {dictating ? (
        <ScribePanel
          patientId={patientId}
          createRecorder={createRecorder}
          onClose={() => setDictating(false)}
        />
      ) : null}
      {tab === 'versions' ? (
        <VersionsPanel patientId={patientId} />
      ) : (
        <div className="record-grid">
          <SummaryPanel vm={vm} />
          <Timeline vm={vm} />
          <SideColumn overview={vm.overview}>
            {session.role === 'medecin' || session.role === 'infirmier' ? (
              <ReadmissionCard record={vm} patientId={patientId} />
            ) : null}
          </SideColumn>
        </div>
      )}
    </>
  );
});
