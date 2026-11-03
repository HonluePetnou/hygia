'use client';

import { observer } from 'mobx-react-lite';
import { useId } from 'react';
import type { IngestionViewModel } from '@hygia/view-models';
import { useSession } from '@/lib/session-context';

/** Champ « Rattacher au patient » (facultatif). */
export const PatientAttach = observer(function PatientAttach({ vm }: { vm: IngestionViewModel }) {
  const { t } = useSession();
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {t('import.attach')}
      </label>
      <select
        id={id}
        className="input"
        value={vm.patientId}
        onChange={(event) => vm.setPatient(event.target.value)}
      >
        <option value="">{t('import.attach.none')}</option>
        {vm.patients.map((patient) => (
          <option key={patient.id} value={patient.id}>
            {patient.givenName} {patient.familyName} · {patient.ipp}
          </option>
        ))}
      </select>
    </div>
  );
});
