'use client';

import { Check } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useSession } from '@/lib/session-context';

/** Indicateur des deux étapes de connexion. */
export const Stepper = observer(function Stepper() {
  const { t, step } = useSession();
  const onCode = step !== 'credentials';
  return (
    <ol className="stepper">
      <li aria-current={onCode ? undefined : 'step'}>
        <span className="step-dot" aria-hidden="true">
          {onCode ? <Check size={14} strokeWidth={2.5} /> : 1}
        </span>
        {t('login.step.credentials')}
      </li>
      <li aria-hidden="true" className="step-line" />
      <li aria-current={onCode ? 'step' : undefined}>
        <span className={onCode ? 'step-dot' : 'step-dot step-dot-todo'} aria-hidden="true">
          2
        </span>
        {t('login.step.verification')}
      </li>
    </ol>
  );
});
