'use client';

import Link from 'next/link';
import { observer } from 'mobx-react-lite';
import type { DuplicatesViewModel } from '@hygia/view-models';
import { Badge, Button } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Bandeaux « doublon d'identité probable » avec « Ignorer » et « Comparer et fusionner ». */
export const DuplicateBanners = observer(function DuplicateBanners({
  vm,
}: {
  vm: DuplicatesViewModel;
}) {
  const { t } = useSession();
  return (
    <>
      {vm.banners.map((banner) => (
        <div key={banner.id} className="duplicate-banner" role="status">
          <Badge tone="warning">{banner.percent} %</Badge>
          <p>{banner.message}</p>
          <div className="duplicate-actions">
            <Button variant="ghost" onClick={() => void vm.ignore(banner.id)}>
              {t('duplicate.ignore')}
            </Button>
            <Link className="btn btn-primary" href={`/patients/doublons/${banner.id}`}>
              {t('duplicate.compare')}
            </Link>
          </div>
        </div>
      ))}
    </>
  );
});
