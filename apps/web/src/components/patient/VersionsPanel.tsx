'use client';

import { observer } from 'mobx-react-lite';
import { VersionsViewModel } from '@hygia/view-models';
import { Badge, Card } from '@/components/ui';
import { useGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';
import { useViewModel } from '@/lib/use-view-model';
import { VersionComparison } from './VersionComparison';

/** Onglet « Versions » du dossier : historique de la fiche et des documents, puis comparaison. */
export const VersionsPanel = observer(function VersionsPanel({ patientId }: { patientId: string }) {
  const session = useSession();
  const gateway = useGateway();
  const { t } = session;
  const vm = useViewModel(
    () => new VersionsViewModel(gateway, session),
    (model) => void model.load(patientId),
  );

  if (vm.errorMessage) return <p role="alert">{vm.errorMessage}</p>;
  if (vm.state !== 'ready') return <p>{t('state.loading')}</p>;

  return (
    <div className="versions-grid" role="tabpanel" aria-labelledby="versions-title">
      <section>
        <h2 id="versions-title">{t('versions.title')}</h2>
        {vm.emptyMessage ? <p className="muted">{vm.emptyMessage}</p> : null}
        <ul className="versions-list">
          {vm.rows.map((row) => (
            <li key={row.key}>
              <Card className={row.selected ? 'version-card is-selected' : 'version-card'}>
                <label className="version-check">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={() => vm.toggle(row.key)}
                    aria-label={t('versions.select', { n: row.number, title: row.title })}
                  />
                  <span className="version-title">{row.title}</span>
                  <Badge tone="neutral">{row.typeLabel}</Badge>
                </label>
                <p>
                  <strong>{row.numberLabel}</strong> · {row.dateLabel} ·{' '}
                  {t('versions.by', { author: row.authorLabel })}
                </p>
                <p className="muted small">{t('versions.reason', { reason: row.reason })}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>
      <VersionComparison vm={vm} />
    </div>
  );
});
