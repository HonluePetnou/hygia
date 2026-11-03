'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  FileUp,
  Home,
  Plus,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { Avatar } from '@/components/ui';
import { useSession } from '@/lib/session-context';

interface NavItem {
  href: string;
  labelKey: string;
  Icon: LucideIcon;
}

interface NavSection {
  titleKey: string;
  items: readonly NavItem[];
}

const SECTIONS: readonly NavSection[] = [
  {
    titleKey: 'nav.section.clinic',
    items: [
      { href: '/', labelKey: 'nav.home', Icon: Home },
      { href: '/patients', labelKey: 'nav.patients', Icon: Users },
      { href: '/copilote', labelKey: 'nav.copilot', Icon: Sparkles },
      { href: '/import', labelKey: 'nav.import', Icon: FileUp },
    ],
  },
  {
    titleKey: 'nav.section.analysis',
    items: [{ href: '/alertes', labelKey: 'nav.alerts', Icon: Bell }],
  },
  {
    titleKey: 'nav.section.compliance',
    items: [{ href: '/audit', labelKey: 'nav.audit', Icon: ScrollText }],
  },
];

/** Barre latérale sombre : logo, établissement, sections et utilisateur. */
export const Sidebar = observer(function Sidebar() {
  const { t, email, roleLabel } = useSession();
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="sidebar">
      <div className="brand-logo">
        <span className="brand-mark" aria-hidden="true">
          <Plus size={20} strokeWidth={2.5} />
        </span>
        HYGIA
      </div>
      <p className="sidebar-establishment">{t('shell.establishment')}</p>
      <nav aria-label={t('nav.main')}>
        {SECTIONS.map((section) => (
          <div key={section.titleKey}>
            <p className="nav-section-title">{t(section.titleKey)}</p>
            <ul className="nav-list">
              {section.items.map(({ href, labelKey, Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="nav-link"
                    aria-current={isActive(href) ? 'page' : undefined}
                  >
                    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                    {t(labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="sidebar-user">
        <Avatar name={email.split('@')[0]?.replace(/[._-]/g, ' ') ?? roleLabel} />
        <div>
          <strong>{roleLabel}</strong>
          <small>
            <ShieldCheck size={13} strokeWidth={1.75} aria-hidden="true" />
            {t('shell.verifiedSession')}
          </small>
        </div>
      </div>
    </aside>
  );
});
