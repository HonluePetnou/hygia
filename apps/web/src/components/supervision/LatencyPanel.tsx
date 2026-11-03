'use client';

import { observer } from 'mobx-react-lite';
import { CHART_HEIGHT, CHART_WIDTH, type SupervisionViewModel } from '@hygia/view-models';
import { Badge } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Courbe de latence p95 de l'ouverture d'un dossier, objectif < 2 s, zone surlignée pendant l'exercice. */
export const LatencyPanel = observer(function LatencyPanel({ vm }: { vm: SupervisionViewModel }) {
  const { t } = useSession();
  const chart = vm.chart;
  return (
    <section className="card supervision-latency" aria-labelledby="supervision-latency-title">
      <div className="supervision-panel-head">
        <div>
          <h2 id="supervision-latency-title">{t('supervision.latency.title')}</h2>
          <p className="muted">{t('supervision.latency.objective')}</p>
        </div>
        <Badge tone={vm.sloMet ? 'success' : 'danger'} role="status">
          {vm.sloMet ? t('supervision.slo.met') : t('supervision.slo.missed')}
        </Badge>
      </div>
      {chart === null ? null : (
        <svg
          className="supervision-chart"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label={t('supervision.latency.chart')}
          preserveAspectRatio="none"
        >
          {chart.highlight === null ? null : (
            <rect
              className="supervision-chart-highlight"
              x={chart.highlight.x}
              y={0}
              width={chart.highlight.width}
              height={CHART_HEIGHT}
            />
          )}
          <path className="supervision-chart-area" d={chart.area} />
          <path className="supervision-chart-line" d={chart.line} />
        </svg>
      )}
      <p className="muted supervision-caption">{vm.latencyCaption}</p>
    </section>
  );
});
