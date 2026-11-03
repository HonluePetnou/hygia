'use client';

import Link from 'next/link';
import { observer } from 'mobx-react-lite';
import { DuplicatesViewModel, PatientSearchViewModel } from '@hygia/view-models';
import { formatDate } from '@hygia/i18n';
import { Avatar, Card, Input } from '@/components/ui';
import { useGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';
import { useViewModel } from '@/lib/use-view-model';
import { DuplicateBanners } from './DuplicateBanners';

/** Liste des patients avec recherche par nom ou IPP. */
export const PatientsScreen = observer(function PatientsScreen() {
  const session = useSession();
  const gateway = useGateway();
  const vm = useViewModel(
    () => new PatientSearchViewModel(gateway, session),
    (model) => void model.search(),
  );
  const duplicates = useViewModel(
    () => new DuplicatesViewModel(gateway, session),
    (model) => void model.load(),
  );
  const { t, locale } = session;

  return (
    <>
      <h1>{t('patients.title')}</h1>
      <DuplicateBanners vm={duplicates} />
      <Card className="patients-card">
        <Input
          type="search"
          label={t('patients.search.label')}
          value={vm.query}
          onChange={(event) => void vm.setQuery(event.target.value)}
        />
        {vm.errorMessage ? <p role="alert">{vm.errorMessage}</p> : null}
        {vm.emptyMessage ? <p className="muted">{vm.emptyMessage}</p> : null}
        {vm.results.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{t('patients.col.name')}</th>
                <th scope="col">{t('patients.col.ipp')}</th>
                <th scope="col">{t('patients.col.birthDate')}</th>
              </tr>
            </thead>
            <tbody>
              {vm.results.map((patient) => {
                const name = `${patient.givenName} ${patient.familyName}`;
                return (
                  <tr key={patient.id}>
                    <td>
                      <span className="cell-person">
                        <Avatar name={name} />
                        <Link href={`/patients/${patient.id}`}>{name}</Link>
                      </span>
                    </td>
                    <td>{patient.ipp}</td>
                    <td>{formatDate(patient.birthDate, locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </Card>
    </>
  );
});
