'use client';

import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { UserPlus } from 'lucide-react';
import { AdministrationViewModel } from '@hygia/view-models';
import { Button } from '@/components/ui';
import { useAdministrationGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';
import { useViewModel } from '@/lib/use-view-model';
import { InviteDialog } from './InviteDialog';
import { PolicyCard } from './PolicyCard';
import { TeamsPanel } from './TeamsPanel';
import { UsersTable } from './UsersTable';

/** Écran « Administration » (maquette 11) : comptes, rôles, équipes de soins, politique de sécurité. */
export const AdministrationScreen = observer(function AdministrationScreen() {
  const session = useSession();
  const gateway = useAdministrationGateway();
  const vm = useViewModel(
    () => new AdministrationViewModel(gateway, session),
    (model) => void model.load(),
  );
  const [inviting, setInviting] = useState(false);
  const { t } = session;
  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t('administration.title')}</h1>
          <p className="muted">{t('administration.subtitle')}</p>
        </div>
        <Button onClick={() => setInviting(true)} disabled={vm.state !== 'ready'}>
          <UserPlus size={16} aria-hidden="true" /> {t('administration.invite.open')}
        </Button>
      </header>
      {vm.state === 'forbidden' ? <p role="alert">{t('administration.forbidden')}</p> : null}
      {vm.state === 'error' ? <p role="alert">{t('administration.error')}</p> : null}
      {vm.state === 'idle' || vm.state === 'loading' ? <p>{t('administration.loading')}</p> : null}
      {vm.state === 'ready' ? (
        <>
          {vm.error !== null && !inviting ? <p role="alert">{t(`administration.error.${vm.error}`)}</p> : null}
          {vm.temporaryPassword === null ? null : (
            <section className="supervision-banner" role="status">
              <div>
                <strong>{t('administration.invite.password', { password: vm.temporaryPassword })}</strong>
              </div>
              <Button variant="ghost" onClick={vm.dismissPassword}>
                {t('administration.invite.dismiss')}
              </Button>
            </section>
          )}
          <div className="admin-layout">
            <section className="card" aria-labelledby="administration-users-title">
              <h2 id="administration-users-title">{t('administration.users.title')}</h2>
              <UsersTable vm={vm} />
            </section>
            <div className="admin-side">
              <TeamsPanel vm={vm} />
              <PolicyCard vm={vm} />
            </div>
          </div>
          {inviting ? <InviteDialog vm={vm} onClose={() => setInviting(false)} /> : null}
        </>
      ) : null}
    </>
  );
});
