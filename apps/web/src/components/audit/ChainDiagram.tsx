'use client';

import { observer } from 'mobx-react-lite';
import { ChevronRight } from 'lucide-react';
import type { AuditViewModel } from '@hygia/view-models';
import { useSession } from '@/lib/session-context';

/** Schéma de chaînage des 3 dernières entrées : chaque maillon porte le hachage du précédent. */
export const ChainDiagram = observer(function ChainDiagram({ vm }: { vm: AuditViewModel }) {
  const { t } = useSession();
  return (
    <section className="card audit-chain" aria-label={t('audit.chaining.title')}>
      <h2>{t('audit.chaining.title')}</h2>
      <ol className="audit-chain-list">
        {vm.chain.map((link, i) => (
          <li key={link.lamport} className="audit-chain-item">
            {i > 0 ? <ChevronRight size={16} aria-hidden="true" className="muted" /> : null}
            <span className={`audit-chain-link${link.latest ? ' is-latest' : ''}`}>
              <strong>L #{link.lamport}</strong>
              <code>{link.shortHash}</code>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
});
