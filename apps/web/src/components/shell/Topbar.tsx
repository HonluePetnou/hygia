'use client';

import { Bell, LogOut, Search } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Badge, Button } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Barre supérieure : recherche, état réseau, bascule FR/EN, notifications. */
export const Topbar = observer(function Topbar() {
  const session = useSession();
  const { t } = session;
  return (
    <header className="topbar">
      <div className="search" role="search">
        <Search size={18} strokeWidth={1.75} aria-hidden="true" />
        <input
          className="input"
          type="search"
          aria-label={t('shell.search')}
          placeholder={t('shell.search')}
        />
      </div>
      <div className="topbar-actions">
        <Badge tone="success" className="network-state">
          {t('shell.online')}
        </Badge>
        <LanguageSwitch />
        <button type="button" className="icon-button" aria-label={t('shell.notifications')}>
          <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <Button variant="ghost" onClick={session.signOut}>
          <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
          {t('shell.signOut')}
        </Button>
      </div>
    </header>
  );
});
