'use client';

import { observer } from 'mobx-react-lite';
import {
  CAMEROON_OUTLINE,
  projectPoint,
  type Bubble,
  type EpidemiologyViewModel,
} from '@hygia/view-models';
import { Card } from '@/components/ui';
import { useSession } from '@/lib/session-context';

const WIDTH = 480;
const HEIGHT = 660;
const MIN_RADIUS = 6;
const MAX_RADIUS = 26;

const OUTLINE = CAMEROON_OUTLINE.map((point) => {
  const { x, y } = projectPoint(point, WIDTH, HEIGHT);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}).join(' ');

/** Carte SVG du Cameroun : une bulle par district, proportionnelle aux cas, halo animé sur un foyer. */
export const OutbreakMap = observer(function OutbreakMap({ vm }: { vm: EpidemiologyViewModel }) {
  const { t } = useSession();
  const max = Math.max(1, ...vm.bubbles.map((bubble) => bubble.cases));
  const radiusOf = (bubble: Bubble) => MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(bubble.cases / max);
  const hovered = vm.hoveredBubble;
  const live = t(`epidemiology.live.${vm.liveStatus}`);
  return (
    <Card className="epi-map-card">
      <div className="epi-map-head">
        <div>
          <h2>
            {t('epidemiology.map.title', {
              pathology: t(`epidemiology.pathology.${vm.pathology}`),
              week: vm.weekNumber ?? '–',
            })}
          </h2>
          <p className="muted">
            {t('epidemiology.map.summary', { cases: vm.totalCases, regions: vm.regionCount })}
          </p>
        </div>
        <span className={`epi-live epi-live-${vm.liveStatus}`} role="status" data-testid="live-status">
          {live}
        </span>
      </div>
      <div className="epi-map">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={t('epidemiology.map.label')}>
          <polygon points={OUTLINE} className="epi-outline" />
          {vm.bubbles.map((bubble) => {
            const { x, y } = projectPoint(bubble, WIDTH, HEIGHT);
            const radius = radiusOf(bubble);
            const level = t(`epidemiology.legend.${bubble.level}`);
            return (
              <g
                key={bubble.district}
                className={`epi-bubble epi-${bubble.level}`}
                tabIndex={0}
                role="img"
                aria-label={t('epidemiology.map.tooltip', { district: bubble.district, cases: bubble.cases, level })}
                onMouseEnter={() => vm.setHovered(bubble.district)}
                onMouseLeave={() => vm.setHovered(null)}
                onFocus={() => vm.setHovered(bubble.district)}
                onBlur={() => vm.setHovered(null)}
              >
                {bubble.level === 'outbreak' ? (
                  <circle className="epi-halo" cx={x} cy={y} r={radius * 2.4} />
                ) : null}
                <circle className="epi-dot" cx={x} cy={y} r={radius} />
                <text x={x + radius + 4} y={y + 4} className="epi-city">
                  {bubble.district}
                </text>
              </g>
            );
          })}
        </svg>
        {hovered ? (
          <div role="tooltip" className="epi-tooltip">
            {t('epidemiology.map.tooltip', {
              district: hovered.district,
              cases: hovered.cases,
              level: t(`epidemiology.legend.${hovered.level}`),
            })}
          </div>
        ) : null}
      </div>
      <ul className="epi-legend" aria-label={t('epidemiology.legend.title')}>
        {(['outbreak', 'rise', 'expected'] as const).map((level) => (
          <li key={level}>
            <span className={`epi-swatch epi-${level}`} aria-hidden="true" />
            {t(`epidemiology.legend.${level}`)}
          </li>
        ))}
      </ul>
      {vm.liveCount > 0 ? (
        <p className="muted" aria-live="polite" data-testid="live-count">
          {t('epidemiology.live.received', { count: vm.liveCount })}
        </p>
      ) : null}
    </Card>
  );
});
