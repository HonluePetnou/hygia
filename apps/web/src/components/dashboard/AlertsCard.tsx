'use client';

import Link from 'next/link';
import { observer } from 'mobx-react-lite';
import type { DashboardAlert } from '@hygia/view-models';
import { Badge, Card } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Carte des alertes IA ouvertes ; la barre de gauche porte la couleur de la gravité. */
export const AlertsCard = observer(function AlertsCard({ alerts }: { alerts: DashboardAlert[] }) {
  const { t } = useSession();
  return (
    <Card className="dashboard-alerts">
      <div className="card-title-row">
        <h2>{t('dashboard.alerts.title')}</h2>
        <Badge tone="danger">{t('dashboard.alerts.count', { count: alerts.length })}</Badge>
      </div>
      {alerts.length === 0 ? <p className="muted">{t('dashboard.alerts.empty')}</p> : null}
      <ul className="alert-list">
        {alerts.map((alert) => (
          <li key={alert.id} className={`alert-item severity-${alert.severity}`}>
            <span className="muted">{alert.severityLabel}</span>
            <Link href="/alertes">{alert.text}</Link>
          </li>
        ))}
      </ul>
    </Card>
  );
});
