'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  FileUp,
  Home,
  Map,
  Plus,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { OpenAlertsViewModel } from '@hygia/view-models';
import { Avatar } from '@/components/ui';
import { useGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';
import { useViewModel } from '@/lib/use-view-model';

interface NavItem {
  href: string;
  labelKey: string;
  Icon: LucideIcon;
}

interface NavSection {
  titleKey: string;
  items: readonly NavItem[];
}

/** Profil analyste : agrégats pseudonymisés seulement, aucun accès aux dossiers identifiés. */
const ANALYST_SECTIONS: readonly NavSection[] = [
  {
    titleKey: 'nav.section.analysis',
    items: [{ href: '/epidemiologie', labelKey: 'nav.epidemiology', Icon: Map }],
  },
];

/** Profil auditeur : le journal d'audit seulement (section Conformité). */
const AUDITOR_SECTIONS: readonly NavSection[] = [
  {
    titleKey: 'nav.section.compliance',
    items: [{ href: '/audit', labelKey: 'nav.audit', Icon: ScrollText }],
  },
];

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
  const { t, email, roleLabel, role } = useSession();
  const isAnalyst = role === 'analyste';
  const isAuditor = role === 'auditeur';
  const sections = isAnalyst ? ANALYST_SECTIONS : isAuditor ? AUDITOR_SECTIONS : SECTIONS;
  const pathname = usePathname();
  const gateway = useGateway();
  const openAlerts = useViewModel(
    () => new OpenAlertsViewModel(gateway),
    (model) => {
      if (!isAnalyst && !isAuditor) void model.refresh();
    },
  );
  // Le compteur est relu à chaque changement de page (une décision change le nombre d'alertes ouvertes).
  useEffect(() => {
    if (!isAnalyst && !isAuditor) void openAlerts.refresh();
  }, [pathname, isAnalyst, isAuditor]);
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
        {sections.map((section) => (
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
                    {href === '/alertes' && openAlerts.count > 0 ? (
                      <span
                        className="nav-count"
                        aria-label={t('alerts.tab.open', { count: openAlerts.count })}
                        data-testid="nav-alerts-count"
                      >
                        {openAlerts.count}
                      </span>
                    ) : null}
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
