'use client';

import {
  AlertTriangle,
  FileText,
  FlaskConical,
  Pill,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { PatientRecordViewModel, TimelineEntryType } from '@hygia/view-models';
import { formatDate } from '@hygia/i18n';
import { Badge, Card, type BadgeTone } from '@/components/ui';
import { useSession } from '@/lib/session-context';

const TYPES: Record<TimelineEntryType, { Icon: LucideIcon; tone: BadgeTone }> = {
  consultation: { Icon: Stethoscope, tone: 'info' },
  examen: { Icon: FlaskConical, tone: 'success' },
  prescription: { Icon: Pill, tone: 'ai' },
  document: { Icon: FileText, tone: 'neutral' },
  alerte: { Icon: AlertTriangle, tone: 'danger' },
};

/** Chronologie filtrable : date, pastille d'icône, carte (titre, type, détail, auteur). */
export const Timeline = observer(function Timeline({ vm }: { vm: PatientRecordViewModel }) {
  const { t, locale } = useSession();
  return (
    <section aria-labelledby="timeline-title" className="timeline">
      <h2 id="timeline-title" className="sr-only">
        {vm.labels.timeline}
      </h2>
      <div className="filter-chips" role="group" aria-label={t('patient.timeline.filters')}>
        {vm.filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className="chip"
            aria-pressed={filter.selected}
            onClick={() => vm.setFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {vm.timelineEmptyMessage ? <p className="muted">{vm.timelineEmptyMessage}</p> : null}
      <ol className="timeline-list">
        {vm.visibleTimeline.map((entry) => {
          const { Icon, tone } = TYPES[entry.type];
          return (
            <li key={entry.resource.reference} className="timeline-item">
              <time dateTime={entry.date} className="timeline-date">
                {formatDate(entry.date, locale)}
              </time>
              <span className={`timeline-dot dot-${tone}`} aria-hidden="true">
                <Icon size={16} />
              </span>
              <Card className={entry.type === 'alerte' ? 'timeline-card is-alert' : 'timeline-card'}>
                <div className="card-title-row">
                  <h3>{entry.label}</h3>
                  <Badge tone={tone}>{t(`patient.timeline.type.${entry.type}`)}</Badge>
                </div>
                {entry.detail ? <p>{entry.detail}</p> : null}
                {entry.author ? <p className="muted small">{entry.author}</p> : null}
              </Card>
            </li>
          );
        })}
      </ol>
    </section>
  );
});
