'use client';

import { FileText, Sparkles } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { CopiloteMessage, CopiloteViewModel } from '@hygia/view-models';
import { formatDate } from '@hygia/i18n';
import { Badge } from '@/components/ui';
import { useSession } from '@/lib/session-context';
import { AnswerText } from './AnswerText';

const Answer = observer(function Answer({
  vm,
  message,
}: {
  vm: CopiloteViewModel;
  message: CopiloteMessage;
}) {
  const { t, locale } = useSession();
  const answeredIn = vm.answeredInLabel(message);
  return (
    <article className="msg msg-assistant" aria-label={vm.authorLabel(message)}>
      <span className="msg-avatar" aria-hidden="true">
        <Sparkles size={16} />
      </span>
      <div className="msg-body">
        {message.streaming && message.text === '' ? (
          <p className="muted">{t('copilot.streaming')}</p>
        ) : (
          <AnswerText vm={vm} message={message} />
        )}
        {message.sources.length > 0 ? (
          <>
            <ul className="source-chips" aria-label={vm.labels.sources}>
              {message.sources.map((source) => (
                <li key={source.n}>
                  <button
                    type="button"
                    className="source-chip"
                    aria-pressed={
                      vm.opened?.messageId === message.id && vm.opened.source.n === source.n
                    }
                    aria-label={t('copilot.openSource', { n: source.n })}
                    onClick={() => vm.openSource(message.id, source.n)}
                  >
                    <span className="source-chip-n">{source.n}</span>
                    <FileText size={14} aria-hidden="true" />
                    {source.titre} · {formatDate(source.date, locale)}
                  </button>
                </li>
              ))}
              {answeredIn ? (
                <li>
                  <Badge tone="info">{answeredIn}</Badge>
                </li>
              ) : null}
            </ul>
            <p className="muted small">
              {t('copilot.passagesFound', { count: message.sources.length })} ·{' '}
              {t('copilot.disclaimer')}
            </p>
          </>
        ) : null}
        {message.sources.length === 0 && answeredIn ? <Badge tone="info">{answeredIn}</Badge> : null}
      </div>
    </article>
  );
});

/** Historique : questions en bulles d'encre, réponses sourcées au fil de l'eau. */
export const Conversation = observer(function Conversation({ vm }: { vm: CopiloteViewModel }) {
  const { t } = useSession();
  return (
    <div className="conversation" role="log" aria-label={t('copilot.conversation')} aria-live="polite">
      {vm.messages.map((message) =>
        message.author === 'user' ? (
          <p key={message.id} className="bubble-user" aria-label={vm.authorLabel(message)}>
            {message.text}
          </p>
        ) : (
          <Answer key={message.id} vm={vm} message={message} />
        ),
      )}
    </div>
  );
});
