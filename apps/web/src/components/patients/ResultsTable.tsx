'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { formatDate } from '@hygia/i18n';
import type { RecordSearchViewModel } from '@hygia/view-models';
import { Avatar, Badge, Button } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Tableau des résultats (maquette « 03 · Patients ») avec pagination. */
export const ResultsTable = observer(function ResultsTable({ vm }: { vm: RecordSearchViewModel }) {
  const { t, locale } = useSession();
  if (vm.results.length === 0) return null;
  return (
    <>
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">{t('patients.col.name')}</th>
            <th scope="col">{t('patients.col.ageGender')}</th>
            <th scope="col">{t('patients.col.diagnoses')}</th>
            <th scope="col">{t('patients.col.lastVisit')}</th>
            <th scope="col">{t('patients.col.organization')}</th>
            <th scope="col">{t('patients.col.language')}</th>
          </tr>
        </thead>
        <tbody>
          {vm.results.map((row) => {
            const name = `${row.givenName} ${row.familyName}`;
            return (
              <tr key={row.id}>
                <td>
                  <span className="cell-person">
                    <Avatar name={name} />
                    <span>
                      <Link href={`/patients/${row.id}`}>{name}</Link>
                      <br />
                      <small className="muted">{row.ipp}</small>
                    </span>
                  </span>
                </td>
                <td>
                  {row.age} · {t(`patients.gender.${row.gender}`)}
                </td>
                <td>
                  <span className="badge-row">
                    {row.diagnoses.map((d) => (
                      <Badge key={d.code} tone="info">
                        {d.code} {d.label}
                      </Badge>
                    ))}
                  </span>
                </td>
                <td>{row.lastVisit ? formatDate(row.lastVisit, locale) : '—'}</td>
                <td>{row.organization ?? '—'}</td>
                <td>
                  <Badge>{row.language.toUpperCase()}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <nav className="results-footer" aria-label={t('patients.pagination')}>
        <span className="muted">
          {t(vm.total === 1 ? 'patients.results.one' : 'patients.results.other', {
            count: vm.total,
          })}
        </span>
        <span className="pager">
          <Button variant="ghost" disabled={!vm.hasPrevious} onClick={() => void vm.goToPage(vm.page - 1)}>
            {t('patients.previous')}
          </Button>
          <span aria-current="page">{t('patients.page', { page: vm.page })}</span>
          <Button variant="secondary" disabled={!vm.hasNext} onClick={() => void vm.goToPage(vm.page + 1)}>
            {t('patients.next')}
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </span>
      </nav>
    </>
  );
});
