'use client';

import { useId } from 'react';
import { Check, FileText, Send, X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { AlertsViewModel } from '@hygia/view-models';
import { Button } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** « Votre décision » : justification et boutons, ou décision déjà enregistrée. */
export const DecisionPanel = observer(function DecisionPanel({ vm }: { vm: AlertsViewModel }) {
  const { t } = useSession();
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const view = vm.detailView;
  if (!view) return null;
  const error = vm.decisionErrorMessage;

  if (view.decided) {
    return (
      <section className="alerts-decision" aria-labelledby={`${inputId}-title`}>
        <h2 id={`${inputId}-title`} className="alerts-section-title">
          {t('alerts.decision')}
        </h2>
        <p>{view.decided.text}</p>
        {view.decided.justification ? <p className="muted">{view.decided.justification}</p> : null}
      </section>
    );
  }

  return (
    <section className="alerts-decision" aria-labelledby={`${inputId}-title`}>
      <h2 id={`${inputId}-title`}>{t('alerts.decision')}</h2>
      <label className="field-label" htmlFor={inputId}>
        {t('alerts.justification')}
      </label>
      <div className="search">
        <FileText size={16} aria-hidden="true" />
        <input
          id={inputId}
          className="input"
          value={vm.justification}
          placeholder={t('alerts.justification.placeholder')}
          aria-invalid={error === null ? undefined : true}
          aria-describedby={error === null ? undefined : errorId}
          onChange={(event) => vm.setJustification(event.target.value)}
        />
      </div>
      {error ? (
        <span id={errorId} className="field-error" role="alert">
          {error}
        </span>
      ) : null}
      <div className="alerts-decision-actions">
        <Button variant="danger" disabled={!vm.canDecide} onClick={() => void vm.decide('rejeter')}>
          <X size={16} aria-hidden="true" />
          {t('alerts.reject')}
        </Button>
        <Button variant="secondary" disabled={!vm.canDecide} onClick={() => void vm.decide('accepter')}>
          <Check size={16} aria-hidden="true" />
          {t('alerts.accept')}
        </Button>
        <Button variant="primary" disabled={!vm.canDecide} onClick={() => void vm.decide('accepter_notifier')}>
          <Send size={16} aria-hidden="true" />
          {t('alerts.acceptNotify')}
        </Button>
      </div>
    </section>
  );
});
