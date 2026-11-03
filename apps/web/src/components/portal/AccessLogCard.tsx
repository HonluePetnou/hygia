'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { PortalViewModel } from '@hygia/view-models';
import { Badge, Button } from '@/components/ui';
import { useSession } from '@/lib/session-context';
import { formatWhen } from './format';

const TONE = { read: 'info', breakGlass: 'warning', agent: 'ai', add: 'neutral' } as const;

/** « Qui a vu mon dossier ? » : journal des accès du patient et signalement à la DPO. */
export const AccessLogCard = observer(function AccessLogCard({ vm }: { vm: PortalViewModel }) {
  const { t, locale } = useSession();
  const [reporting, setReporting] = useState(false);
  const [selected, setSelected] = useState('');
  const rows = vm.rows;
  const submit = async () => {
    if (selected === '') return;
    await vm.report(Number(selected));
    setReporting(false);
    setSelected('');
  };
  return (
    <section className="card portal-access" id="acces" aria-labelledby="portal-access-title">
      <header className="portal-card-head">
        <div>
          <h2 id="portal-access-title">{t('portal.access.title')}</h2>
          <p className="muted small">{t('portal.access.subtitle', { count: vm.logTotal })}</p>
        </div>
        {vm.canShowAll || vm.showAll ? (
          <Button variant="ghost" onClick={vm.toggleShowAll}>
            {vm.showAll ? t('portal.access.showLess') : t('portal.access.showAll')}
          </Button>
        ) : null}
      </header>
      {rows.length === 0 ? <p className="muted">{t('portal.access.empty')}</p> : null}
      <ul className="portal-log" aria-label={t('portal.access.list')}>
        {rows.map((row) => (
          <li key={row.key} className={`portal-log-row portal-log-${row.kind}`}>
            <span className="portal-initials" aria-hidden="true">
              {row.initials}
            </span>
            <div className="portal-log-body">
              <strong>{row.actor}</strong> <span className="muted small">· {row.roleLabel}</span>
              <p>{row.sentence}</p>
            </div>
            <div className="portal-log-meta">
              <time dateTime={row.timestamp}>{formatWhen(row.timestamp, locale)}</time>
              <Badge tone={TONE[row.kind]}>{row.badge}</Badge>
            </div>
          </li>
        ))}
      </ul>
      <div className="portal-report">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>{t('portal.report.hint')}</p>
        <Button
          variant="secondary"
          onClick={() => setReporting((open) => !open)}
          aria-expanded={reporting}
        >
          {t('portal.report.button')}
        </Button>
      </div>
      {reporting ? (
        <form
          className="portal-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label htmlFor="portal-report-select">{t('portal.report.choose')}</label>
          <select
            id="portal-report-select"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="" />
            {rows.map((row) => (
              <option key={row.key} value={row.index}>
                {formatWhen(row.timestamp, locale)} — {row.actor}
              </option>
            ))}
          </select>
          <div className="portal-form-actions">
            <Button type="submit" disabled={selected === ''}>
              {t('portal.rights.send')}
            </Button>
            <Button variant="ghost" onClick={() => setReporting(false)}>
              {t('portal.rights.cancel')}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
});
