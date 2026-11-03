'use client';

import { useEffect } from 'react';
import { Download, Search, Sparkles } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { DuplicatesViewModel, RecordSearchViewModel } from '@hygia/view-models';
import { Badge, Button, Card } from '@/components/ui';
import { downloadFile } from '@/lib/download-file';
import { useGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';
import { useViewModel } from '@/lib/use-view-model';
import { DuplicateBanners } from './DuplicateBanners';
import { ResultsTable } from './ResultsTable';
import { SearchChips } from './SearchChips';

/**
 * Liste des patients : recherche par nom, IPP ou question en langage naturel, puces des filtres
 * compris (supprimables), tableau paginé.
 *
 * @param initialQuery Requête reçue de la barre supérieure (`/patients?q=…`).
 */
export const PatientsScreen = observer(function PatientsScreen({
  initialQuery = '',
}: {
  initialQuery?: string;
}) {
  const session = useSession();
  const gateway = useGateway();
  const vm = useViewModel(
    () => new RecordSearchViewModel(gateway, session),
    (model) => void model.submit(initialQuery),
  );
  const duplicates = useViewModel(
    () => new DuplicatesViewModel(gateway, session),
    (model) => void model.load(),
  );
  const { t } = session;

  // La barre supérieure change `?q=` sans remonter l'écran : on relance la recherche.
  useEffect(() => {
    if (initialQuery !== vm.query) void vm.submit(initialQuery);
  }, [initialQuery]);

  return (
    <>
      <header className="page-header">
        <h1>{t('patients.title')}</h1>
        <Button
          variant="secondary"
          onClick={() =>
            void vm.exportCsv().then((file) => {
              if (file !== null) downloadFile(file);
            })
          }
        >
          <Download size={16} strokeWidth={1.75} aria-hidden="true" />
          {t('patients.exportCsv')}
        </Button>
      </header>
      {vm.exportFailed ? <p role="alert">{t('export.error')}</p> : null}
      <DuplicateBanners vm={duplicates} />
      <Card className="patients-card">
        <form
          className="nl-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            void vm.submit();
          }}
        >
          <Sparkles size={18} strokeWidth={1.75} aria-hidden="true" />
          <input
            className="input"
            type="search"
            aria-label={t('patients.search.label')}
            placeholder={t('patients.search.label')}
            value={vm.query}
            onChange={(event) => vm.setQuery(event.target.value)}
          />
          <Badge tone="ai">{t('patients.search.badge')}</Badge>
          <Button type="submit">
            <Search size={16} strokeWidth={1.75} aria-hidden="true" />
            {t('patients.search.submit')}
          </Button>
        </form>
        <SearchChips vm={vm} />
        {vm.errorMessage ? <p role="alert">{vm.errorMessage}</p> : null}
        {vm.emptyMessage ? <p className="muted">{vm.emptyMessage}</p> : null}
        <ResultsTable vm={vm} />
      </Card>
    </>
  );
});
