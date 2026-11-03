'use client';

import { observer } from 'mobx-react-lite';
import {
  CAMEROON_REGIONS,
  EPIDEMIOLOGY_PATHOLOGIES,
  EPIDEMIOLOGY_PERIODS,
  type EpidemiologyViewModel,
} from '@hygia/view-models';
import { useSession } from '@/lib/session-context';

/** Puces de pathologie, période et région. */
export const Filters = observer(function Filters({ vm }: { vm: EpidemiologyViewModel }) {
  const { t } = useSession();
  return (
    <div className="epi-filters">
      <div role="group" aria-label={t('epidemiology.pathologies')} className="epi-chips">
        {EPIDEMIOLOGY_PATHOLOGIES.map((pathology) => (
          <button
            key={pathology}
            type="button"
            className={`epi-chip${vm.pathology === pathology ? ' is-active' : ''}`}
            aria-pressed={vm.pathology === pathology}
            onClick={() => void vm.setPathology(pathology)}
          >
            {t(`epidemiology.pathology.${pathology}`)}
          </button>
        ))}
      </div>
      <div className="epi-selects">
        <select
          aria-label={t('epidemiology.period')}
          value={vm.period}
          onChange={(event) => void vm.setPeriod(Number(event.target.value))}
        >
          {EPIDEMIOLOGY_PERIODS.map((period) => (
            <option key={period} value={period}>
              {t(`epidemiology.period.${period}`)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('epidemiology.region')}
          value={vm.region}
          onChange={(event) => void vm.setRegion(event.target.value)}
        >
          <option value="all">{t('epidemiology.region.all')}</option>
          {CAMEROON_REGIONS.map((region) => (
            <option key={region} value={region}>
              {t(`epidemiology.region.${region}`)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
});
