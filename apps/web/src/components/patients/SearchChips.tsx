'use client';

import { X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { RecordSearchViewModel } from '@hygia/view-models';
import { Badge } from '@/components/ui';
import { useSession } from '@/lib/session-context';
import { filterLabel } from './filter-label';

/** Puces « Compris comme » : chaque filtre compris est supprimable et relance la recherche. */
export const SearchChips = observer(function SearchChips({ vm }: { vm: RecordSearchViewModel }) {
  const { t, locale } = useSession();
  if (vm.state === 'idle') return null;
  return (
    <div className="search-chips">
      <span className="muted">{t('patients.search.understood')}</span>
      <ul aria-label={t('patients.search.understood')}>
        {vm.filters.map((filter, index) => {
          const label = filterLabel(filter, t, locale);
          return (
            <li key={`${filter.kind}-${index}`} className="chip">
              <span>{label}</span>
              <button
                type="button"
                aria-label={t('patients.chip.remove', { filter: label })}
                onClick={() => void vm.removeFilter(index)}
              >
                <X size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      {vm.state === 'ready' && vm.filters.length === 0 ? (
        <Badge tone="neutral">{t('patients.search.noFilter')}</Badge>
      ) : null}
    </div>
  );
});
