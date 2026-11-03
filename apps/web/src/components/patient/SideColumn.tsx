'use client';

import type { ReactNode } from 'react';
import { Pill } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { PatientOverview } from '@hygia/view-models';
import { Avatar, Card } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Colonne de droite : constantes, traitements en cours et équipe de soins. */
export const SideColumn = observer(function SideColumn({
  overview,
  children,
}: {
  overview: PatientOverview;
  /** Cartes supplémentaires (ex. risque de réadmission), sous les traitements. */
  children?: ReactNode;
}) {
  const { t } = useSession();
  return (
    <div className="record-side">
      <Card aria-labelledby="vitals-title">
        <h2 id="vitals-title">{t('patient.vitals.title')}</h2>
        {overview.vitals.length === 0 ? <p className="muted">{t('patient.vitals.empty')}</p> : null}
        <dl className="vitals">
          {overview.vitals.map((vital) => (
            <div key={vital.label}>
              <dt className="muted">{vital.label}</dt>
              <dd>
                <strong>{vital.value}</strong> <span className="muted">{vital.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card aria-labelledby="treatments-title">
        <h2 id="treatments-title">{t('patient.treatments.title')}</h2>
        {overview.treatments.length === 0 ? (
          <p className="muted">{t('patient.treatments.empty')}</p>
        ) : null}
        <ul className="treatments">
          {overview.treatments.map((treatment) => (
            <li key={treatment.label} className={treatment.flagged ? 'is-flagged' : undefined}>
              <Pill size={16} aria-hidden="true" />
              <span>
                <strong>{treatment.label}</strong>
                <span className="muted small">{treatment.dosage}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {children}

      <Card aria-labelledby="team-title">
        <h2 id="team-title">{t('patient.careTeam.title')}</h2>
        <p className="muted">{t('patient.careTeam.subtitle')}</p>
        <ul className="care-team">
          {overview.careTeam.map((member) => (
            <li key={member.id}>
              <Avatar name={member.name} />
              <span>
                <strong>{member.name}</strong>
                <span className="muted small">{member.role}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
});
