import { AlertTriangle, FileText, FlaskConical, Users, type LucideIcon } from 'lucide-react';
import type { Indicator } from '@hygia/view-models';
import { Card } from '@/components/ui';

const ICONS: Record<Indicator['id'], { Icon: LucideIcon; tone: string }> = {
  patientsToday: { Icon: Users, tone: 'success' },
  pendingAlerts: { Icon: AlertTriangle, tone: 'danger' },
  documentsInProgress: { Icon: FileText, tone: 'ai' },
  resultsToValidate: { Icon: FlaskConical, tone: 'warning' },
};

/** Les quatre indicateurs du tableau de bord. */
export function IndicatorCards({ indicators }: { indicators: Indicator[] }) {
  return (
    <ul className="indicators">
      {indicators.map(({ id, label, value }) => {
        const { Icon, tone } = ICONS[id];
        return (
          <li key={id}>
            <Card className="indicator" data-testid={`indicator-${id}`}>
              <span className="indicator-label">
                <span className={`icon-chip icon-chip-${tone}`} aria-hidden="true">
                  <Icon size={16} />
                </span>
                {label}
              </span>
              <strong className="indicator-value">{value}</strong>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
