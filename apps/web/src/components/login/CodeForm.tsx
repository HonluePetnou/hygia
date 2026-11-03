'use client';

import { useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Input } from '@/components/ui';
import { useSession } from '@/lib/session-context';
import { EnrollmentPanel } from './EnrollmentPanel';
import { OtpInput } from './OtpInput';

/** Étape 2 : code à 6 chiffres (ou code de secours) ; à la première connexion, enrôlement par QR code. */
export const CodeForm = observer(function CodeForm() {
  const session = useSession();
  const { t } = session;
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState('');
  const enrolling = session.step === 'enroll';

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = session.backupMode ? await session.submitBackupCode(backup) : await session.submitCode(code);
    if (!ok) {
      setCode('');
      setBackup('');
    }
  };

  return (
    <form className="login-form" onSubmit={onSubmit} noValidate>
      <div>
        <h1>{enrolling ? t('mfa.enroll.title') : t('mfa.heading')}</h1>
        <p className="muted">{t('mfa.description', { email: session.email })}</p>
      </div>
      {enrolling ? <EnrollmentPanel /> : null}
      {session.backupMode ? (
        <Input
          label={t('mfa.backupLabel')}
          autoComplete="off"
          value={backup}
          onChange={(event) => setBackup(event.target.value)}
          error={session.errorMessage}
        />
      ) : (
        <OtpInput
          value={code}
          onChange={setCode}
          groupLabel={t('mfa.code')}
          cellLabel={(n) => t('mfa.digit', { n })}
          invalid={session.errorKey !== null}
        />
      )}
      {!session.backupMode && session.errorMessage ? (
        <span className="field-error" role="alert">
          {session.errorMessage}
        </span>
      ) : null}
      <Button
        type="submit"
        block
        disabled={session.submitting || (session.backupMode ? backup.trim() === '' : code.length !== 6)}
      >
        {t('mfa.verify')}
      </Button>
      {enrolling ? null : (
        <p className="muted">
          {t('mfa.noAccess')}{' '}
          <button type="button" className="link-button" onClick={session.toggleBackupMode}>
            {session.backupMode ? t('mfa.useApp') : t('mfa.backupCode')}
          </button>
        </p>
      )}
    </form>
  );
});
