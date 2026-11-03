'use client';

import Link from 'next/link';
import { observer } from 'mobx-react-lite';
import type { ConsultationRow } from '@hygia/view-models';
import { Avatar, Badge, Card, type BadgeTone } from '@/components/ui';
import { useSession } from '@/lib/session-context';

const STATUS_TONES: Record<ConsultationRow['status'], BadgeTone> = {
  done: 'success',
  inProgress: 'info',
  alert: 'danger',
  upcoming: 'neutral',
};

/** Tableau des consultations du jour : heure, patient, motif, statut, résumé IA. */
export const ConsultationsTable = observer(function ConsultationsTable({
  rows,
}: {
  rows: ConsultationRow[];
}) {
  const { t } = useSession();
  return (
    <Card className="dashboard-consultations">
      <h2>{t('dashboard.consultations.title')}</h2>
      {rows.length === 0 ? (
        <p className="muted">{t('dashboard.consultations.empty')}</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{t('dashboard.col.time')}</th>
              <th scope="col">{t('dashboard.col.patient')}</th>
              <th scope="col">{t('dashboard.col.reason')}</th>
              <th scope="col">{t('dashboard.col.status')}</th>
              <th scope="col">
                <span className="sr-only">{t('dashboard.aiSummary')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="time">{row.time}</td>
                <td>
                  <span className="cell-person">
                    <Avatar name={row.patientName} />
                    {row.patientName}
                  </span>
                </td>
                <td>{row.reason}</td>
                <td>
                  <Badge tone={STATUS_TONES[row.status]}>{row.statusLabel}</Badge>
                </td>
                <td>
                  <Link
                    href={`/patients/${row.patientId}`}
                    className="btn btn-secondary"
                    aria-label={`${t('dashboard.aiSummary')} — ${row.patientName}`}
                  >
                    {t('dashboard.aiSummary')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
});
