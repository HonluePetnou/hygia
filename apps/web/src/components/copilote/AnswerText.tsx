'use client';

import { observer } from 'mobx-react-lite';
import type { CopiloteMessage, CopiloteViewModel } from '@hygia/view-models';
import { useSession } from '@/lib/session-context';

/** Texte d'une réponse : les marqueurs `[n]` qui ont une source deviennent des boutons violets. */
export const AnswerText = observer(function AnswerText({
  vm,
  message,
}: {
  vm: CopiloteViewModel;
  message: CopiloteMessage;
}) {
  const { t } = useSession();
  return (
    <p className="answer-text">
      {vm.segments(message).map((segment, index) => {
        if (segment.kind === 'text') return <span key={index}>{segment.text}</span>;
        const known = message.sources.some((s) => s.n === segment.n);
        if (!known) return <span key={index}>{`[${segment.n}]`}</span>;
        return (
          <button
            key={index}
            type="button"
            className="source-marker"
            aria-label={t('copilot.openSource', { n: segment.n })}
            onClick={() => vm.openSource(message.id, segment.n)}
          >
            {`[${segment.n}]`}
          </button>
        );
      })}
    </p>
  );
});
