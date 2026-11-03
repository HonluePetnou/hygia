'use client';

import { observer } from 'mobx-react-lite';
import type { EpidemiologyViewModel } from '@hygia/view-models';
import { Card } from '@/components/ui';
import { useSession } from '@/lib/session-context';

const WIDTH = 320;
const HEIGHT = 120;
const PAD = 6;

/** Courbe des 12 dernières semaines avec le seuil d'alerte en pointillés rouges. */
export const SeriesChart = observer(function SeriesChart({ vm }: { vm: EpidemiologyViewModel }) {
  const { t } = useSession();
  const district = vm.chartDistrict;
  const series = vm.series;
  if (district === null || series.length === 0) {
    return (
      <Card>
        <p className="muted">{t('epidemiology.chart.empty')}</p>
      </Card>
    );
  }
  const max = Math.max(1, ...series.map((p) => Math.max(p.cases, p.threshold)));
  const x = (i: number) => PAD + (i / Math.max(1, series.length - 1)) * (WIDTH - 2 * PAD);
  const y = (value: number) => HEIGHT - PAD - (value / max) * (HEIGHT - 2 * PAD);
  const line = series.map((p, i) => `${x(i).toFixed(1)},${y(p.cases).toFixed(1)}`).join(' ');
  const area = `${PAD},${HEIGHT - PAD} ${line} ${WIDTH - PAD},${HEIGHT - PAD}`;
  const threshold = series.map((p, i) => `${x(i).toFixed(1)},${y(p.threshold).toFixed(1)}`).join(' ');
  const last = series[series.length - 1];
  return (
    <Card>
      <h2>{t('epidemiology.chart.title', { district })}</h2>
      <p className="muted">{t('epidemiology.chart.subtitle')}</p>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={t('epidemiology.chart.label', { district })}
        className="epi-chart"
      >
        <polygon points={area} className="epi-area" />
        <polyline points={threshold} className="epi-threshold" />
        <polyline points={line} className="epi-line" />
        {last ? (
          <circle cx={x(series.length - 1)} cy={y(last.cases)} r={4} className={last.anomaly ? 'epi-point-alert' : 'epi-point'} />
        ) : null}
      </svg>
      <p className="epi-chart-legend">
        <span className="epi-key-line">{t('epidemiology.chart.cases')}</span>
        <span className="epi-key-threshold">{t('epidemiology.chart.threshold')}</span>
      </p>
    </Card>
  );
});
