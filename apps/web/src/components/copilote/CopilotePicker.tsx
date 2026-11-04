'use client';

import Link from 'next/link';
import { ChevronRight, Search, Sparkles } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { RecordSearchViewModel } from '@hygia/view-models';
import { Avatar, Button, Card } from '@/components/ui';
import { useGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';
import { useViewModel } from '@/lib/use-view-model';

/**
 * « Copilote IA » depuis le menu : le copilote travaille sur un dossier, on choisit donc d'abord
 * le patient (ceux de l'équipe de soins), puis le copilote s'ouvre sur son dossier.
 */
export const CopilotePicker = observer(function CopilotePicker() {
  const session = useSession();
  const gateway = useGateway();
  const vm = useViewModel(
    () => new RecordSearchViewModel(gateway, session),
    (model) => void model.submit(''),
  );
  const { t } = session;

  return (
    <>
      <header className="page-header">
        <h1>{t('copilot.title')}</h1>
      </header>
      <Card className="patients-card">
        <p className="muted">
          <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" /> {t('copilot.pick.intro')}
        </p>
        <form
          className="nl-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            void vm.submit();
          }}
        >
          <Search size={18} strokeWidth={1.75} aria-hidden="true" />
          <input
            className="input"
            type="search"
            aria-label={t('copilot.pick.search')}
            placeholder={t('copilot.pick.search')}
            value={vm.query}
            onChange={(event) => vm.setQuery(event.target.value)}
          />
          <Button type="submit">{t('patients.search.submit')}</Button>
        </form>
        {vm.errorMessage ? <p role="alert">{vm.errorMessage}</p> : null}
        {vm.emptyMessage ? <p className="muted">{t('copilot.pick.empty')}</p> : null}
        <ul className="copilot-pick-list">
          {vm.results.map((row) => {
            const name = `${row.givenName} ${row.familyName}`;
            return (
              <li key={row.id}>
                <Link
                  href={`/copilote/${row.id}`}
                  className="cell-person"
                  aria-label={`${name} · ${row.ipp} — ${t('copilot.pick.open')}`}
                >
                  <Avatar name={name} />
                  <span>
                    <strong>{name}</strong>
                    <br />
                    <small className="muted">
                      {row.ipp} · {row.age} · {t(`patients.gender.${row.gender}`)}
                    </small>
                  </span>
                  <span className="copilot-pick-open">
                    {t('copilot.pick.open')}
                    <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
});
