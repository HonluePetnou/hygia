'use client';

import { observer } from 'mobx-react-lite';
import { Download } from 'lucide-react';
import { AuditViewModel } from '@hygia/view-models';
import { Badge, Button } from '@/components/ui';
import { useAuditGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';
import { useViewModel } from '@/lib/use-view-model';
import { AuditFilters } from './AuditFilters';
import { AuditIndicators } from './AuditIndicators';
import { AuditTable } from './AuditTable';
import { ChainDiagram } from './ChainDiagram';
import { downloadCsv } from './download-csv';

/** Écran « Journal d'audit » (maquette 09), profil auditeur · DPO. */
export const AuditScreen = observer(function AuditScreen() {
  const session = useSession();
  const gateway = useAuditGateway();
  const vm = useViewModel(
    () => new AuditViewModel(gateway, session),
    (model) => void model.load(),
  );
  const { t } = session;
  const onExport = async () => {
    const csv = await vm.exportCsv();
    if (csv !== null) downloadCsv(csv, 'journal-audit.csv');
  };
  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t('audit.title')}</h1>
          <p className="muted">{t('audit.subtitle')}</p>
        </div>
        <div className="audit-head-actions">
          {vm.summary !== null ? (
            <Badge tone={vm.chainIntact ? 'success' : 'danger'} role="status">
              {vm.chainLabel}
            </Badge>
          ) : null}
          <Button variant="secondary" onClick={() => void onExport()}>
            <Download size={16} aria-hidden="true" /> {t('audit.export')}
          </Button>
        </div>
      </header>
      {vm.exportFailed ? <p role="alert">{t('audit.export.error')}</p> : null}
      {vm.state === 'forbidden' ? <p role="alert">{t('audit.forbidden')}</p> : null}
      {vm.state === 'error' ? <p role="alert">{t('audit.error')}</p> : null}
      {vm.state === 'idle' || vm.state === 'loading' ? <p>{t('state.loading')}</p> : null}
      {vm.state === 'ready' ? (
        <>
          <div className="audit-top">
            <AuditIndicators vm={vm} />
            <ChainDiagram vm={vm} />
          </div>
          <section className="card audit-log">
            <AuditFilters vm={vm} />
            <AuditTable vm={vm} />
            <p className="muted audit-footer">{t('audit.footer')}</p>
          </section>
        </>
      ) : null}
    </>
  );
});
