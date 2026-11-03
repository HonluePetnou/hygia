'use client';

import { AlertTriangle, Check, FileText, Sparkles } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { PatientRecordViewModel } from '@hygia/view-models';
import { formatDate } from '@hygia/i18n';
import { Badge, Button, Card } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Résumé pré-consultation généré par IA : sections, sources numérotées, validation. */
export const SummaryPanel = observer(function SummaryPanel({
  vm,
}: {
  vm: PatientRecordViewModel;
}) {
  const { t, locale } = useSession();
  const view = vm.summaryView;
  if (!view) return null;
  const regular = view.sections.filter((s) => s.id !== 'alertes');
  const alerts = view.sections.find((s) => s.id === 'alertes');

  return (
    <Card className="summary-panel" aria-labelledby="summary-title">
      <div className="card-title-row">
        <h2 id="summary-title" className="with-icon">
          <Sparkles size={16} aria-hidden="true" />
          {vm.labels.preConsultation}
        </h2>
        <Badge tone="ai">{t('patient.preConsultation.badge')}</Badge>
      </div>
      <p className="muted">{vm.labels.generatedByAi}</p>

      {regular.map((section) => (
        <section key={section.id} aria-label={section.title}>
          <h3 className="eyebrow">{section.title}</h3>
          <ul className="summary-lines">
            {section.lines.map((line) => (
              <li key={line.text}>
                <span>{line.text}</span>
                {line.refs.map((n) => (
                  <sup key={n} className="source-ref" aria-label={t('patient.preConsultation.source', { n })}>
                    {n}
                  </sup>
                ))}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {alerts && alerts.lines.length > 0 ? (
        <div className="summary-alert" role="note">
          <AlertTriangle size={16} aria-hidden="true" />
          <ul>
            {alerts.lines.map((line) => (
              <li key={line.text}>{line.text}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section aria-label={t('patient.preConsultation.sources')}>
        <h3 className="eyebrow">{t('patient.preConsultation.sources')}</h3>
        <ol className="source-list">
          {view.sources.map((source) => (
            <li key={source.n}>
              <span className="source-ref">{source.n}</span>
              <FileText size={14} aria-hidden="true" />
              {source.title} · {formatDate(source.date, locale)}
            </li>
          ))}
        </ol>
      </section>

      {vm.summaryValidated ? (
        <p role="status" className="validated">
          <Check size={16} aria-hidden="true" /> {t('patient.preConsultation.validated')}
        </p>
      ) : (
        <Button onClick={vm.validateSummary}>
          <Check size={16} aria-hidden="true" />
          {vm.labels.validate}
        </Button>
      )}
      <p className="muted small">{t('patient.preConsultation.decisionAid')}</p>
    </Card>
  );
});
