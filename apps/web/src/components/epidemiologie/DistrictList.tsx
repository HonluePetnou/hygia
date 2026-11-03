'use client';

import { observer } from 'mobx-react-lite';
import type { EpidemiologyViewModel } from '@hygia/view-models';
import { Badge, Card } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Districts les plus touchés (5 premiers de la région choisie). */
export const DistrictList = observer(function DistrictList({ vm }: { vm: EpidemiologyViewModel }) {
  const { t } = useSession();
  const levelOf = (district: string) => vm.bubbles.find((b) => b.district === district)?.level;
  return (
    <Card>
      <h2>{t('epidemiology.districts.title')}</h2>
      {vm.topDistricts.length === 0 ? (
        <p className="muted">{t('epidemiology.districts.empty')}</p>
      ) : (
        <ul className="epi-districts">
          {vm.topDistricts.map((rank) => {
            const level = levelOf(rank.district);
            const tone = level === 'outbreak' ? 'danger' : level === 'rise' ? 'warning' : 'neutral';
            return (
              <li key={rank.district}>
                <span>{rank.district}</span>
                <Badge tone={tone}>{t('epidemiology.districts.cases', { count: rank.cases })}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
});
