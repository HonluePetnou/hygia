'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { CopiloteViewModel } from '@hygia/view-models';
import { formatDate } from '@hygia/i18n';
import { Card } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Panneau de droite : titre, date et extrait cité surligné de la source ouverte. */
export const SourcePanel = observer(function SourcePanel({
  vm,
  patientId,
}: {
  vm: CopiloteViewModel;
  patientId: string;
}) {
  const { t, locale } = useSession();
  if (!vm.opened) return null;
  const { source } = vm.opened;
  return (
    <Card className="source-panel" role="complementary" aria-label={t('copilot.sourcePanel')}>
      <div className="card-title-row">
        <div>
          <h2 className="source-title">
            <span className="source-chip-n">{source.n}</span> {source.titre}
          </h2>
          <p className="muted small">
            {t('copilot.sourcePanel.meta', {
              date: formatDate(source.date, locale),
              id: source.documentId.slice(0, 8),
            })}
          </p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label={t('copilot.sourcePanel.close')}
          onClick={vm.closeSource}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <h3 className="eyebrow">{t('copilot.sourcePanel.cited')}</h3>
      <blockquote className="cited-passage">
        <mark>{source.extrait}</mark>
      </blockquote>
      <Link className="btn btn-secondary btn-block" href={`/patients/${patientId}`}>
        {t('copilot.openTimeline')}
      </Link>
    </Card>
  );
});
