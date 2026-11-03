'use client';

import { observer } from 'mobx-react-lite';
import type { VersionsViewModel } from '@hygia/view-models';
import { Card } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Comparaison côte à côte de deux versions ; les champs modifiés sont surlignés. */
export const VersionComparison = observer(function VersionComparison({
  vm,
}: {
  vm: VersionsViewModel;
}) {
  const { t } = useSession();
  const comparison = vm.comparison;
  return (
    <Card className="version-compare" aria-live="polite">
      <h2>{t('versions.compare.title')}</h2>
      {comparison === null ? (
        <p className="muted">{t('versions.compare.hint')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{t('versions.compare.field')}</th>
              <th scope="col">{comparison.leftLabel}</th>
              <th scope="col">{comparison.rightLabel}</th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr key={row.field} className={row.changed ? 'is-changed' : undefined}>
                <th scope="row">
                  {row.label}
                  {row.changed ? <span className="sr-only"> ({t('versions.compare.changed')})</span> : null}
                </th>
                <td>{row.left}</td>
                <td>{row.right}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
});
