'use client';

import Link from 'next/link';
import { observer } from 'mobx-react-lite';
import { MergeViewModel, type MergeField } from '@hygia/view-models';
import { Button, Card, Input } from '@/components/ui';
import { useGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';
import { useViewModel } from '@/lib/use-view-model';

/** Écran de comparaison côte à côte de deux dossiers en doublon, avec confirmation de la fusion. */
export const MergeScreen = observer(function MergeScreen({ duplicateId }: { duplicateId: string }) {
  const session = useSession();
  const gateway = useGateway();
  const vm = useViewModel(
    () => new MergeViewModel(gateway, session),
    (model) => void model.load(duplicateId),
  );
  const { t } = session;
  const pair = vm.candidate;

  return (
    <>
      <h1>{t('merge.title')}</h1>
      <p>
        <Link href="/patients">{t('merge.back')}</Link>
      </p>
      {vm.state === 'error' ? <p role="alert">{t('error.generic')}</p> : null}
      {vm.errorKey ? <p role="alert">{t(vm.errorKey)}</p> : null}
      {vm.state === 'ready' && pair === null && vm.outcome === null ? (
        <p className="muted">{t('merge.notFound')}</p>
      ) : null}
      {vm.outcome ? (
        <Card className="merge-done" aria-live="polite">
          <p>
            {vm.outcome.undone
              ? t('merge.undone')
              : t('merge.done', {
                  encounters: vm.outcome.moved.encounters,
                  observations: vm.outcome.moved.observations,
                  prescriptions: vm.outcome.moved.medicationRequests,
                  documents: vm.outcome.moved.documents,
                })}
          </p>
          {vm.outcome.undone ? null : (
            <Button variant="secondary" onClick={() => void vm.undo()}>
              {t('merge.undo')}
            </Button>
          )}
        </Card>
      ) : null}
      {pair && vm.outcome === null ? (
        <Card className="merge-compare">
          <p>{t('merge.intro')}</p>
          <p className="muted">{t('merge.score', { percent: vm.percent })}</p>
          <table>
            <thead>
              <tr>
                <th scope="col">{t('merge.field')}</th>
                <th scope="col">{t('merge.col.a', { ipp: pair.a.ipp })}</th>
                <th scope="col">{t('merge.col.b', { ipp: pair.b.ipp })}</th>
              </tr>
            </thead>
            <tbody>
              {vm.rows.map((row) => (
                <tr key={row.field} className={row.differs ? 'is-changed' : undefined}>
                  <th scope="row">{row.label}</th>
                  {(['a', 'b'] as const).map((side) => (
                    <td key={side}>
                      {row.choosable ? (
                        <label>
                          <input
                            type="radio"
                            name={`merge-${row.field}`}
                            checked={row.choice === side}
                            onChange={() => vm.choose(row.field as MergeField, side)}
                            aria-label={t('merge.keepValue', { value: row[side], field: row.label })}
                          />{' '}
                          {row[side]}
                        </label>
                      ) : (
                        row[side]
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <Input
            label={t('merge.reason')}
            value={vm.reason}
            onChange={(event) => vm.setReason(event.target.value)}
          />
          {vm.confirming ? (
            <div role="alertdialog" aria-labelledby="merge-confirm-title" className="merge-confirm">
              <h2 id="merge-confirm-title">{t('merge.confirm.title')}</h2>
              <p>{t('merge.confirm.text', { merged: pair.b.ipp, kept: pair.a.ipp })}</p>
              <Button disabled={vm.submitting} onClick={() => void vm.confirm()}>
                {t('merge.confirm.yes')}
              </Button>
              <Button variant="ghost" onClick={vm.cancelConfirmation}>
                {t('merge.confirm.no')}
              </Button>
            </div>
          ) : (
            <Button onClick={vm.requestConfirmation} disabled={vm.reason.trim() === ''}>
              {t('merge.submit')}
            </Button>
          )}
        </Card>
      ) : null}
    </>
  );
});
