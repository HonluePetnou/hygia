'use client';

import { observer } from 'mobx-react-lite';
import { useSession } from '@/lib/session-context';

/** Bascule FR / EN reliée à la session. */
export const LanguageSwitch = observer(function LanguageSwitch() {
  const session = useSession();
  const { t, locale } = session;
  return (
    <div className="lang-switch" role="group" aria-label={t('shell.language')}>
      <button type="button" aria-pressed={locale === 'fr'} onClick={() => session.setLocale('fr')}>
        {t('lang.fr')}
      </button>
      <button type="button" aria-pressed={locale === 'en'} onClick={() => session.setLocale('en')}>
        {t('lang.en')}
      </button>
    </div>
  );
});
