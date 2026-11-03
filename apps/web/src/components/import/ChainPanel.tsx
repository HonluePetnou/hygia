'use client';

import { AlertCircle, Check, Clock, Loader, RefreshCw, type LucideIcon } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { IngestionStepStatus, IngestionViewModel } from '@hygia/view-models';
import { Badge, Card, type BadgeTone } from '@/components/ui';
import { useSession } from '@/lib/session-context';

const STATUS_ICONS: Record<IngestionStepStatus, LucideIcon> = {
  done: Check,
  inProgress: Loader,
  pending: Clock,
  failed: AlertCircle,
};

const STATUS_TONES: Record<IngestionStepStatus, BadgeTone> = {
  done: 'success',
  inProgress: 'ai',
  pending: 'neutral',
  failed: 'danger',
};

/** Panneau « Chaîne d'analyse » : 5 étapes (statut, durée) puis les branches 6a et 6b. */
export const ChainPanel = observer(function ChainPanel({ vm }: { vm: IngestionViewModel }) {
  const { t } = useSession();
  const failedStep = vm.stepViews.find((step) => step.status === 'failed');
  return (
    <Card className="chain-panel" role="region" aria-labelledby="chain-title">
      <div className="card-title-row">
        <div>
          <h2 id="chain-title">{t('import.chain.title')}</h2>
          <p className="muted small">{t('import.chain.subtitle', { file: vm.fileLabel })}</p>
        </div>
        <Badge tone={STATUS_TONES[vm.chainStatus]}>{vm.chainStatusLabel}</Badge>
      </div>
      <ol className="chain-steps">
        {vm.stepViews.map((step, index) => {
          const Icon = STATUS_ICONS[step.status];
          return (
            <li key={step.id} className={`chain-step chain-step-${step.status}`}>
              <span className="step-icon" aria-hidden="true">
                <Icon size={16} />
              </span>
              <div className="step-text">
                <strong>
                  {index + 1} · {step.label}
                </strong>
                <span className="muted small">{step.detail}</span>
              </div>
              <span className="step-status">
                {step.durationMs === null
                  ? step.statusLabel
                  : `${step.statusLabel} · ${t('import.step.duration', {
                      seconds: (step.durationMs / 1000).toFixed(1),
                    })}`}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="branches">
        {(['clinical', 'analytic'] as const).map((branch) => (
          <div key={branch} className={`branch branch-${branch}`} data-status={vm.branches[branch]}>
            <strong>
              {branch === 'clinical' ? '6a' : '6b'} · {t(`import.branch.${branch}`)}
            </strong>
            <span className="small">{t(`import.branch.${branch}.detail`)}</span>
          </div>
        ))}
      </div>
      {failedStep ? (
        <p role="alert" className="field-error">
          {t('import.error', { step: failedStep.label })}
        </p>
      ) : null}
      <p className="muted small with-icon">
        <RefreshCw size={14} aria-hidden="true" />
        {t('import.chain.footer')}
      </p>
    </Card>
  );
});
