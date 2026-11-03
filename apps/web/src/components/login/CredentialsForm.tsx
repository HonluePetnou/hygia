'use client';

import { useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Input } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Étape 1 : adresse e-mail et mot de passe. */
export const CredentialsForm = observer(function CredentialsForm() {
  const session = useSession();
  const { t } = session;
  const [email, setEmail] = useState(session.email);
  const [password, setPassword] = useState('');

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    session.submitCredentials(email, password);
  };

  return (
    <form className="login-form" onSubmit={onSubmit} noValidate>
      <div>
        <h1>{t('login.heading')}</h1>
        <p className="muted">{t('login.subtitle')}</p>
      </div>
      <Input
        label={t('login.email')}
        type="email"
        autoComplete="username"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Input
        label={t('login.password')}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={session.errorMessage}
      />
      <Button type="submit" block>
        {t('login.submit')}
      </Button>
    </form>
  );
});
