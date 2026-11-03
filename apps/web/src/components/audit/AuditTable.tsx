'use client';

import { observer } from 'mobx-react-lite';
import type { AuditViewModel } from '@hygia/view-models';
import { Badge, Button } from '@/components/ui';
import { useSession } from '@/lib/session-context';

const COLUMNS = ['lamport', 'time', 'actor', 'action', 'resource', 'reason', 'hash'] as const;

/** Tableau paginé du journal ; la ligne de bris de glace est surlignée. */
export const AuditTable = observer(function AuditTable({ vm }: { vm: AuditViewModel }) {
  const { t } = useSession();
  if (vm.rows.length === 0) return <p className="muted">{t('audit.empty')}</p>;
  return (
    <>
      <table className="data-table audit-table" aria-label={t('audit.table.label')}>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col">
                {t(`audit.col.${column}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vm.rows.map((row) => (
            <tr key={row.key} className={row.highlighted ? 'audit-row-alert' : undefined}>
              <td className="audit-mono">{row.lamport}</td>
              <td className="time">{row.time}</td>
              <td>
                <strong>{row.actor}</strong>
                <br />
                <small className="muted">{row.roleLabel}</small>
              </td>
              <td>
                <Badge tone={row.highlighted ? 'warning' : 'neutral'}>{row.actionLabel}</Badge>
              </td>
              <td>{row.resource}</td>
              <td>{row.reason}</td>
              <td className="audit-mono">{row.shortHash}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <nav className="audit-pager" aria-label={t('audit.page', { page: vm.page, pages: vm.pageCount })}>
        <Button variant="ghost" disabled={vm.page <= 1} onClick={() => void vm.goTo(vm.page - 1)}>
          {t('audit.prev')}
        </Button>
        <span>{t('audit.page', { page: vm.page, pages: vm.pageCount })}</span>
        <Button variant="ghost" disabled={vm.page >= vm.pageCount} onClick={() => void vm.goTo(vm.page + 1)}>
          {t('audit.next')}
        </Button>
      </nav>
    </>
  );
});
