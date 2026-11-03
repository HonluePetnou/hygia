'use client';

import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ReadmissionViewModel, type PatientRecordViewModel } from '@hygia/view-models';
import type { MessageKey } from '@hygia/i18n';
import { Card } from '@/components/ui';
import { useReadmissionGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';

/** Carte « Risque de réadmission à 30 jours » : jauge, trois facteurs principaux, aide à la décision. */
export const ReadmissionCard = observer(function ReadmissionCard({
  record,
  patientId,
}: {
  record: PatientRecordViewModel;
  patientId: string;
}) {
  const { t } = useSession();
  const gateway = useReadmissionGateway();
  const [vm] = useState(() => new ReadmissionViewModel(gateway));

  useEffect(() => {
    if (!record.patient || !record.overview) return;
    void vm.load(patientId, {
      patient: record.patient,
      timeline: record.timeline,
      treatments: record.overview.treatments,
      summary: record.summary,
    });
  }, [vm, patientId, record.patient, record.overview, record.timeline, record.summary]);

  const estimate = vm.estimate;
  const percent = estimate ? Math.round(estimate.score * 100) : 0;
  return (
    <Card aria-labelledby="readmission-title">
      <h2 id="readmission-title">{t('readmission.title')}</h2>
      {vm.state === 'consentRevoked' ? (
        <p className="muted">{t('readmission.revoked')}</p>
      ) : null}
      {vm.state === 'error' ? <p className="muted">{t('readmission.error')}</p> : null}
      {estimate ? (
        <>
          <div
            className={`risk-gauge is-${estimate.niveau}`}
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label={t('readmission.gauge', { score: percent })}
          >
            <span className="risk-gauge-fill" style={{ width: `${percent}%` }} />
          </div>
          <p>
            <strong>{percent} %</strong>{' '}
            <span className="muted">{t(`readmission.level.${estimate.niveau}` as MessageKey)}</span>
          </p>
          <h3 className="small muted">{t('readmission.factors')}</h3>
          <ul className="risk-factors">
            {vm.topFactors.map((factor) => (
              <li key={factor.code}>
                <span>{t(`readmission.factor.${factor.code}` as MessageKey)}</span>
                <span className={factor.contribution >= 0 ? 'risk-up' : 'risk-down'}>
                  {factor.contribution >= 0 ? '+' : '−'}
                  {Math.abs(factor.contribution).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="muted small">{t('readmission.aid')}</p>
    </Card>
  );
});
