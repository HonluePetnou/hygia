'use client';

import { Check, X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { EntityView, IngestionViewModel } from '@hygia/view-models';
import { Badge, Button, Card, type BadgeTone } from '@/components/ui';
import { useSession } from '@/lib/session-context';

const KIND_TONES: Record<EntityView['kind'], BadgeTone> = {
  medication: 'ai',
  diagnosis: 'info',
  posology: 'neutral',
  date: 'neutral',
};

const Row = observer(function Row({ vm, entity }: { vm: IngestionViewModel; entity: EntityView }) {
  const { t } = useSession();
  const percent = Math.round(entity.confidence * 100);
  const className = [
    entity.lowConfidence ? 'row-warning' : '',
    entity.decision === 'rejected' ? 'row-rejected' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <tr className={className} data-decision={entity.decision}>
      <td className="source-text">« {entity.sourceText} »</td>
      <td>
        <Badge tone={KIND_TONES[entity.kind]}>{entity.kindLabel}</Badge>
      </td>
      <td>{entity.normalized}</td>
      <td>{entity.code ?? '—'}</td>
      <td>
        <span className="confidence">
          <progress
            max={100}
            value={percent}
            aria-label={`${t('import.entities.col.confidence')} ${percent} %`}
            className={entity.lowConfidence ? 'confidence-low' : undefined}
          />
          {percent} %
        </span>
      </td>
      <td className="row-actions">
        <button
          type="button"
          className="icon-button icon-button-success"
          aria-label={`${t('import.validate')} : ${entity.normalized}`}
          aria-pressed={entity.decision === 'validated'}
          onClick={() => vm.decide(entity.index, 'validated')}
        >
          <Check size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={`${t('import.reject')} : ${entity.normalized}`}
          aria-pressed={entity.decision === 'rejected'}
          onClick={() => vm.decide(entity.index, 'rejected')}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
});

/** Tableau « Entités extraites — à valider » : rien n'est enregistré avant validation. */
export const EntitiesTable = observer(function EntitiesTable({ vm }: { vm: IngestionViewModel }) {
  const { t } = useSession();
  const views = vm.entityViews;
  return (
    <Card role="region" aria-labelledby="entities-title">
      <div className="card-title-row">
        <div>
          <h2 id="entities-title">{t('import.entities.title')}</h2>
          <p className="muted small">{t('import.entities.subtitle', { file: vm.fileLabel })}</p>
        </div>
        <Button disabled={vm.pendingCount === 0} onClick={vm.validateAll}>
          <Check size={16} aria-hidden="true" />
          {t('import.validateAll')}
        </Button>
      </div>
      {views.length === 0 ? (
        <p className="muted">{t('import.entities.empty')}</p>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{t('import.entities.col.source')}</th>
                <th scope="col">{t('import.entities.col.type')}</th>
                <th scope="col">{t('import.entities.col.value')}</th>
                <th scope="col">{t('import.entities.col.code')}</th>
                <th scope="col">{t('import.entities.col.confidence')}</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {views.map((entity) => (
                <Row key={entity.index} vm={vm} entity={entity} />
              ))}
            </tbody>
          </table>
          <p role="status" className="muted small">
            {vm.pendingCount === 0
              ? t('import.allDecided')
              : t('import.pendingCount', { count: vm.pendingCount })}
          </p>
        </>
      )}
    </Card>
  );
});
