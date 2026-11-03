'use client';

import { useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { Button } from '@/components/ui';
import { useSession } from '@/lib/session-context';
import { OtpInput } from './OtpInput';

/** Étape 2 : code de vérification à 6 chiffres. */
export const CodeForm = observer(function CodeForm() {
  const session = useSession();
  const { t } = session;
  const [code, setCode] = useState('');

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!session.submitCode(code)) setCode('');
  };

  return (
    <form className="login-form" onSubmit={onSubmit} noValidate>
      <div>
        <h1>{t('mfa.heading')}</h1>
        <p className="muted">{t('mfa.description', { email: session.email })}</p>
      </div>
      <OtpInput
        value={code}
        onChange={setCode}
        groupLabel={t('mfa.code')}
        cellLabel={(n) => t('mfa.digit', { n })}
        invalid={session.errorKey !== null}
      />
      {session.errorMessage ? (
        <span className="field-error" role="alert">
          {session.errorMessage}
        </span>
      ) : null}
      <Button type="submit" block disabled={code.length !== 6}>
        {t('mfa.verify')}
      </Button>
      <p className="muted">
        {t('mfa.noAccess')} <a href="#secours">{t('mfa.backupCode')}</a>
      </p>
    </form>
  );
});
