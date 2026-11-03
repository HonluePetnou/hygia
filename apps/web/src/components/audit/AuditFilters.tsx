'use client';

import { observer } from 'mobx-react-lite';
import { Search } from 'lucide-react';
import type { AuditViewModel } from '@hygia/view-models';
import { useSession } from '@/lib/session-context';

/** Puces de filtre (Tous, Lectures, …) et recherche libre. */
export const AuditFilters = observer(function AuditFilters({ vm }: { vm: AuditViewModel }) {
  const { t } = useSession();
  return (
    <div className="audit-filters">
      <div role="group" aria-label={t('audit.filters')} className="audit-chips">
        {vm.filters.map((filter) => (
          <button
            key={filter}
            type="button"
            className={`audit-chip${vm.filter === filter ? ' is-active' : ''}`}
            aria-pressed={vm.filter === filter}
            onClick={() => void vm.setFilter(filter)}
          >
            {vm.filterLabel(filter)}
          </button>
        ))}
      </div>
      <label className="audit-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          aria-label={t('audit.search.label')}
          placeholder={t('audit.search.placeholder')}
          value={vm.text}
          onChange={(event) => void vm.setText(event.target.value)}
        />
      </label>
    </div>
  );
});
