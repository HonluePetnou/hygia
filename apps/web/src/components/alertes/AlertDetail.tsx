'use client';

import Link from 'next/link';
import { ChevronRight, Sparkles } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { AlertsViewModel } from '@hygia/view-models';
import { Avatar, Badge, Card } from '@/components/ui';
import { useSession } from '@/lib/session-context';
import { DecisionPanel } from './DecisionPanel';

const SEVERITY_TONE = { high: 'danger', moderate: 'warning', low: 'info' } as const;

/** Colonne de droite : raisonnement de l'agent, sources, proposition et décision. */
export const AlertDetail = observer(function AlertDetail({ vm }: { vm: AlertsViewModel }) {
  const { t } = useSession();
  const view = vm.detailView;
  if (!view) {
    return (
      <Card>
        <p className="muted">{t('alerts.select')}</p>
      </Card>
    );
  }
  return (
    <Card className="alerts-detail" aria-live="polite">
      <div className="alerts-detail-head">
        <Badge tone={SEVERITY_TONE[view.severity]}>{view.severityLabel}</Badge>
        <Badge tone="ai">{view.agentLabel}</Badge>
        <span className="muted">{view.raisedLabel}</span>
      </div>
      <h2>{view.title}</h2>
      {view.patientCard ? (
        <Link href={`/patients/${view.patientId}`} className="alerts-patient-card">
          <Avatar name={view.patientCard.name} />
          <span>
            <strong>
              {view.patientCard.name} · {view.patientCard.age}
            </strong>
            <br />
            <span className="muted">{view.patientCard.ipp}</span>
          </span>
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      ) : null}

      <h3 className="alerts-section-title">{t('alerts.reasoning')}</h3>
      <ol className="alerts-steps">
        {view.steps.map((step) => (
          <li key={step.step}>
            <span className="alerts-step-number" aria-hidden="true">
              {step.step}
            </span>
            <span>{step.title}</span>
          </li>
        ))}
      </ol>

      <h3 className="alerts-section-title">{t('alerts.sources')}</h3>
      <ul className="alerts-sources">
        {view.sources.map((source) => (
          <li key={source.n}>
            <Badge tone="ai" title={source.excerpt}>
              {source.n} · {source.label}
            </Badge>
          </li>
        ))}
      </ul>

      <div className="alerts-proposal">
        <h3>
          <Sparkles size={14} aria-hidden="true" /> {t('alerts.proposal')}
        </h3>
        <p>{view.proposal}</p>
      </div>

      <DecisionPanel vm={vm} />
      <p className="alerts-precision">{view.precision}</p>
    </Card>
  );
});
