'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { useSession } from '@/lib/session-context';
import { BackupCodesPanel } from './BackupCodesPanel';
import { BrandPanel } from './BrandPanel';
import { CodeForm } from './CodeForm';
import { CredentialsForm } from './CredentialsForm';
import { Stepper } from './Stepper';

/** Écran de connexion en deux colonnes : marque à gauche, deux étapes à droite. */
export const LoginScreen = observer(function LoginScreen() {
  const session = useSession();
  const router = useRouter();
  const { t } = session;

  useEffect(() => {
    if (session.isAuthenticated) router.replace('/');
  }, [session.isAuthenticated, router]);

  return (
    <div className="login">
      <BrandPanel />
      <main className="login-main">
        <div className="login-lang">
          <LanguageSwitch />
        </div>
        <div className="login-card">
          <Stepper />
          {session.step === 'credentials' ? <CredentialsForm /> : null}
          {session.step === 'enroll' || session.step === 'code' ? <CodeForm /> : null}
          {session.step === 'backupCodes' ? <BackupCodesPanel /> : null}
          <p className="audit-note">
            <ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" />
            {t('login.audit')}
          </p>
        </div>
        <p className="login-footer">{t('brand.footer')}</p>
      </main>
    </div>
  );
});
