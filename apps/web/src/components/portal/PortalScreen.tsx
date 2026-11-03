'use client';

import { Plus } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { PortalViewModel } from '@hygia/view-models';
import { Avatar, Badge } from '@/components/ui';
import { useAuditGateway, usePortalGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';
import { useViewModel } from '@/lib/use-view-model';
import { AccessLogCard } from './AccessLogCard';
import { ConsentsCard } from './ConsentsCard';
import { PortalHero } from './PortalHero';
import { RightsCard } from './RightsCard';

const NAV = [
  ['#mon-dossier', 'portal.nav.record'],
  ['#rendez-vous', 'portal.nav.appointments'],
  ['#acces', 'portal.nav.access'],
  ['#consentements', 'portal.nav.consents'],
  ['#droits', 'portal.nav.rights'],
] as const;

/** Portail patient `/portail` (maquette 13), réservé au rôle patient. */
export const PortalScreen = observer(function PortalScreen() {
  const session = useSession();
  const portal = usePortalGateway();
  const audit = useAuditGateway();
  const vm = useViewModel(
    () => new PortalViewModel(portal, audit, session),
    (model) => void model.load(),
  );
  const { t, locale } = session;
  return (
    <div className="portal">
      <header className="portal-top">
        <div className="brand-logo">
          <span className="brand-mark" aria-hidden="true">
            <Plus size={20} strokeWidth={2.5} />
          </span>
          HYGIA
        </div>
        <Badge tone="success">{t('portal.nav.space')}</Badge>
        <nav aria-label={t('portal.nav.label')} className="portal-nav">
          {NAV.map(([href, key]) => (
            <a key={href} href={href}>
              {t(key)}
            </a>
          ))}
        </nav>
        <div className="lang-switch" role="group" aria-label={t('shell.language')}>
          <button
            type="button"
            aria-pressed={locale === 'fr'}
            onClick={() => void vm.changeLanguage('fr')}
          >
            {t('lang.fr')}
          </button>
          <button
            type="button"
            aria-pressed={locale === 'en'}
            onClick={() => void vm.changeLanguage('en')}
          >
            {t('lang.en')}
          </button>
        </div>
        <Avatar name={session.displayName} />
      </header>
      <main className="portal-main">
        {vm.noticeKey !== null ? (
          <p
            role={vm.noticeIsError ? 'alert' : 'status'}
            className={vm.noticeIsError ? 'portal-notice portal-notice-error' : 'portal-notice'}
          >
            {t(vm.noticeKey)}
          </p>
        ) : null}
        {vm.state === 'idle' || vm.state === 'loading' ? <p>{t('portal.loading')}</p> : null}
        {vm.state === 'forbidden' ? <p role="alert">{t('portal.denied')}</p> : null}
        {vm.state === 'error' ? <p role="alert">{t('portal.error')}</p> : null}
        {vm.state === 'ready' ? (
          <>
            <PortalHero vm={vm} />
            <div className="portal-grid">
              <AccessLogCard vm={vm} />
              <div className="portal-side">
                <ConsentsCard vm={vm} />
                <RightsCard vm={vm} />
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
});
