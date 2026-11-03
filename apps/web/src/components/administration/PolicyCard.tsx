'use client';

import { observer } from 'mobx-react-lite';
import { ShieldCheck } from 'lucide-react';
import type { AdministrationViewModel } from '@hygia/view-models';
import { useSession } from '@/lib/session-context';

/** Carte « Politique de sécurité » : règles appliquées par le service Identité (lecture seule). */
export const PolicyCard = observer(function PolicyCard({ vm }: { vm: AdministrationViewModel }) {
  const { t } = useSession();
  const { policy } = vm;
  return (
    <section className="card" aria-labelledby="administration-policy-title">
      <h2 id="administration-policy-title">{t('administration.policy.title')}</h2>
      <ul className="admin-policy">
        {policy.mfaRequired ? <li>{t('administration.policy.mfa')}</li> : null}
        <li>{t('administration.policy.session', { minutes: policy.sessionMinutes })}</li>
        <li>{t('administration.policy.breakGlass', { hours: policy.breakGlassHours })}</li>
        <li>{t('administration.policy.password', { length: policy.passwordLength })}</li>
      </ul>
      <p className="muted">
        <ShieldCheck size={14} aria-hidden="true" /> {t('administration.policy.note')}
      </p>
    </section>
  );
});
