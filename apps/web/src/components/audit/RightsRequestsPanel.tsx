'use client';

import { observer } from 'mobx-react-lite';
import type { AuditViewModel } from '@hygia/view-models';
import { useSession } from '@/lib/session-context';

/** Demandes d'exercice des droits et signalements des patients, à traiter par la DPO sous 30 jours. */
export const RightsRequestsPanel = observer(function RightsRequestsPanel({
  vm,
}: {
  vm: AuditViewModel;
}) {
  const { t } = useSession();
  const rows = vm.rightsRows;
  return (
    <section className="card audit-rights" aria-labelledby="audit-rights-title">
      <h2 id="audit-rights-title">{t('audit.rights.title')}</h2>
      <p className="muted">{t('audit.rights.subtitle')}</p>
      {rows.length === 0 ? <p>{t('audit.rights.empty')}</p> : null}
      <ul className="audit-rights-list">
        {rows.map((row) => (
          <li key={row.key} data-testid="rights-request">
            <strong>{row.kindLabel}</strong>
            <span>
              {t('audit.rights.col.patient')} : {row.patientId}
            </span>
            {row.message !== '' ? (
              <span>
                {t('audit.rights.col.detail')} : {row.message}
              </span>
            ) : null}
            <span className="muted">
              {t('audit.rights.col.received')} {row.createdAt} · {t('audit.rights.col.due')}{' '}
              {row.dueAt}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
});
