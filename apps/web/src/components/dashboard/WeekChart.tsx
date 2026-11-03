'use client';

import { observer } from 'mobx-react-lite';
import type { WeekBar } from '@hygia/view-models';
import { Card } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Histogramme des consultations de la semaine (jour courant en évidence). */
export const WeekChart = observer(function WeekChart({ bars }: { bars: WeekBar[] }) {
  const { t } = useSession();
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <Card className="dashboard-week">
      <h2>{t('dashboard.week.title')}</h2>
      <p className="muted">{t('dashboard.week.subtitle')}</p>
      <ul className="week-chart">
        {bars.map((bar) => (
          <li key={bar.day} className={bar.highlighted ? 'is-today' : undefined}>
            <span className="week-value">{bar.value}</span>
            <span className="week-bar" style={{ height: `${(bar.value / max) * 100}%` }} />
            <span className="week-label">{bar.label}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
});
