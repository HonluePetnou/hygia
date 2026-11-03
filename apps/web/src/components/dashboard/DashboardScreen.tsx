'use client';

import Link from 'next/link';
import { FileUp, Sparkles } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { DashboardViewModel } from '@hygia/view-models';
import { useGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';
import { useViewModel } from '@/lib/use-view-model';
import { AlertsCard } from './AlertsCard';
import { ConsultationsTable } from './ConsultationsTable';
import { DocumentsCard } from './DocumentsCard';
import { IndicatorCards } from './IndicatorCards';
import { WeekChart } from './WeekChart';

/** Écran « Accueil — tableau de bord médecin » (maquette 02). */
export const DashboardScreen = observer(function DashboardScreen() {
  const session = useSession();
  const gateway = useGateway();
  const vm = useViewModel(
    () => new DashboardViewModel(gateway, session),
    (model) => void model.load(),
  );
  const { t } = session;

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{vm.greeting(session.displayName)}</h1>
          <p className="muted">{vm.state === 'ready' ? vm.subtitle : t('state.loading')}</p>
        </div>
        <div className="page-actions">
          <Link href="/import" className="btn btn-secondary">
            <FileUp size={16} aria-hidden="true" />
            {t('nav.import')}
          </Link>
          <Link href="/copilote" className="btn btn-ai">
            <Sparkles size={16} aria-hidden="true" />
            {t('patient.askCopilot')}
          </Link>
        </div>
      </header>

      {vm.errorMessage ? <p role="alert">{vm.errorMessage}</p> : null}
      {vm.state === 'ready' ? (
        <>
          <IndicatorCards indicators={vm.indicators} />
          <div className="dashboard-grid">
            <ConsultationsTable rows={vm.consultations} />
            <AlertsCard alerts={vm.alerts} />
            <DocumentsCard documents={vm.documents} />
            <WeekChart bars={vm.week} />
          </div>
        </>
      ) : null}
    </>
  );
});
