'use client';

import { Send } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { FormEvent } from 'react';
import type { CopiloteViewModel } from '@hygia/view-models';
import { useSession } from '@/lib/session-context';

/** Suggestions de questions et zone de saisie. */
export const Composer = observer(function Composer({ vm }: { vm: CopiloteViewModel }) {
  const { t } = useSession();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void vm.send();
  };
  return (
    <div className="composer">
      <ul className="suggestions" aria-label={t('copilot.suggestions')}>
        {vm.suggestions.map((suggestion) => (
          <li key={suggestion}>
            <button
              type="button"
              className="chip"
              disabled={vm.pending}
              onClick={() => void vm.ask(suggestion)}
            >
              {suggestion}
            </button>
          </li>
        ))}
      </ul>
      <form className="composer-form" onSubmit={submit}>
        <input
          className="input"
          type="text"
          aria-label={vm.labels.placeholder}
          placeholder={vm.labels.placeholder}
          value={vm.draft}
          onChange={(event) => vm.setDraft(event.target.value)}
        />
        <button type="submit" className="btn btn-ai" disabled={!vm.canSend}>
          <Send size={16} aria-hidden="true" />
          <span className="sr-only">{vm.labels.send}</span>
        </button>
      </form>
    </div>
  );
});
