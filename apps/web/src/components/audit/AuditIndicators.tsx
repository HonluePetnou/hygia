'use client';

import { observer } from 'mobx-react-lite';
import { Activity, ShieldCheck, Zap } from 'lucide-react';
import type { AuditViewModel } from '@hygia/view-models';
import { useSession } from '@/lib/session-context';

/** Trois indicateurs : événements du jour, bris de glace, ruptures de chaîne. */
export const AuditIndicators = observer(function AuditIndicators({ vm }: { vm: AuditViewModel }) {
  const { t } = useSession();
  const summary = vm.summary;
  if (summary === null) return null;
  const cards = [
    {
      key: 'events',
      Icon: Activity,
      label: t('audit.indicator.events'),
      value: summary.eventsToday,
      note: t('audit.indicator.events.note', { total: summary.total }),
      tone: 'info',
    },
    {
      key: 'breakGlass',
      Icon: Zap,
      label: t('audit.indicator.breakGlass'),
      value: summary.breakGlassToday,
      note: t('audit.indicator.breakGlass.note'),
      tone: 'warning',
    },
    {
      key: 'breaks',
      Icon: ShieldCheck,
      label: t('audit.indicator.breaks'),
      value: summary.chainBreaks,
      note: t('audit.indicator.breaks.note'),
      tone: summary.chainBreaks === 0 ? 'success' : 'danger',
    },
  ] as const;
  return (
    <div className="audit-indicators">
      {cards.map(({ key, Icon, label, value, note, tone }) => (
        <section key={key} className="card audit-indicator" aria-label={label}>
          <p className="audit-indicator-label">
            <span className={`audit-icon audit-icon-${tone}`} aria-hidden="true">
              <Icon size={18} />
            </span>
            {label}
          </p>
          <p className="audit-indicator-value" data-testid={`audit-${key}`}>
            {value.toLocaleString('fr-FR')} <small className="muted">{note}</small>
          </p>
        </section>
      ))}
    </div>
  );
});
