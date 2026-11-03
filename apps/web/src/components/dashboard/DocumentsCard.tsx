'use client';

import { observer } from 'mobx-react-lite';
import type { DocumentRow } from '@hygia/view-models';
import { Badge, Card } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Documents en cours de traitement, avec barre de progression. */
export const DocumentsCard = observer(function DocumentsCard({
  documents,
}: {
  documents: DocumentRow[];
}) {
  const { t } = useSession();
  return (
    <Card className="dashboard-documents">
      <h2>{t('dashboard.documents.title')}</h2>
      {documents.length === 0 ? <p className="muted">{t('dashboard.documents.empty')}</p> : null}
      <ul className="document-list">
        {documents.map((doc) => (
          <li key={doc.id}>
            <div className="document-head">
              <strong>{doc.title}</strong>
              <Badge tone={doc.stage === 'done' ? 'success' : 'ai'}>{doc.stageLabel}</Badge>
            </div>
            <div
              className="progress"
              role="progressbar"
              aria-label={doc.title}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={doc.progress}
            >
              <span style={{ width: `${doc.progress}%` }} data-stage={doc.stage} />
            </div>
            <span className="muted">{doc.source}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
});
