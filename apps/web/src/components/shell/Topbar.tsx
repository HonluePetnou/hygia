'use client';

import { Bell, LogOut, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Badge, Button } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Barre supérieure : recherche (ouvre `/patients?q=…`), état réseau, bascule FR/EN, notifications. */
export const Topbar = observer(function Topbar() {
  const session = useSession();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { t } = session;
  return (
    <header className="topbar">
      <form
        className="search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(`/patients?q=${encodeURIComponent(query.trim())}`);
        }}
      >
        <Search size={18} strokeWidth={1.75} aria-hidden="true" />
        <input
          className="input"
          type="search"
          aria-label={t('shell.search')}
          placeholder={t('shell.search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>
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
