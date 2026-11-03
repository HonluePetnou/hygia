'use client';

import { observer } from 'mobx-react-lite';
import { Button } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Codes de secours affichés une seule fois, juste après l'enrôlement. */
export const BackupCodesPanel = observer(function BackupCodesPanel() {
  const session = useSession();
  const { t } = session;
  return (
    <div className="login-form">
      <div>
        <h1>{t('mfa.backupCodes.title')}</h1>
        <p className="muted">{t('mfa.backupCodes.instructions')}</p>
      </div>
      <ul className="backup-codes">
        {session.backupCodes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ul>
      <Button type="button" block onClick={session.acknowledgeBackupCodes}>
        {t('mfa.backupCodes.done')}
      </Button>
    </div>
  );
});
