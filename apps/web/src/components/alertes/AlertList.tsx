'use client';

import { observer } from 'mobx-react-lite';
import { ALERT_TABS, type AlertsViewModel } from '@hygia/view-models';
import { Badge, Card } from '@/components/ui';
import { useSession } from '@/lib/session-context';

const SEVERITY_TONE = { high: 'danger', moderate: 'warning', low: 'info' } as const;

/** Colonne de gauche : onglets par statut et liste des alertes. */
export const AlertList = observer(function AlertList({ vm }: { vm: AlertsViewModel }) {
  const { t } = useSession();
  return (
    <Card>
      <div role="tablist" aria-label={t('alerts.tabs')} className="alerts-tabs">
        {ALERT_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            className="alerts-tab"
            aria-selected={vm.tab === tab}
            onClick={() => void vm.selectTab(tab)}
          >
            {vm.tabLabel(tab)}
          </button>
        ))}
      </div>
      {vm.rows.length === 0 ? <p className="muted">{t('alerts.empty')}</p> : null}
      <ul className="alerts-items" aria-label={t('alerts.list')}>
        {vm.rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className="alerts-item"
              aria-current={row.selected ? 'true' : undefined}
              onClick={() => void vm.select(row.id)}
            >
              <span className="alerts-item-head">
                <Badge tone={SEVERITY_TONE[row.severity]}>{row.agentLabel}</Badge>
                <span className="muted">{row.age}</span>
              </span>
              <span className="alerts-item-title">{row.title}</span>
              <span className="muted">{row.patientName}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
});
