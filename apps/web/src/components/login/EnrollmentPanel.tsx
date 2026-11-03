'use client';

import { observer } from 'mobx-react-lite';
import { useSession } from '@/lib/session-context';

/** QR code et secret de l'application d'authentification (première connexion). */
export const EnrollmentPanel = observer(function EnrollmentPanel() {
  const { t, enrollment } = useSession();
  if (enrollment === null) return null;
  return (
    <div className="enroll">
      <p className="muted">{t('mfa.enroll.instructions')}</p>
      <img className="enroll-qr" src={enrollment.qrCode} alt={t('mfa.enroll.qrAlt')} width={240} height={240} />
      <p className="muted">
        {t('mfa.enroll.secret')} <code>{enrollment.secret}</code>
      </p>
    </div>
  );
});
