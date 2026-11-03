'use client';

import { Globe } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { CopiloteViewModel } from '@hygia/view-models';
import { Badge, Card } from '@/components/ui';
import { useCopiloteGateway, useGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';
import { useViewModel } from '@/lib/use-view-model';
import { Composer } from './Composer';
import { Conversation } from './Conversation';
import { SourcePanel } from './SourcePanel';

/** Écran « Copilote clinique — réponses sourcées » (maquette 05). */
export const CopiloteScreen = observer(function CopiloteScreen({ patientId }: { patientId: string }) {
  const session = useSession();
  const copilote = useCopiloteGateway();
  const patients = useGateway();
  const vm = useViewModel(
    () => new CopiloteViewModel(copilote, session, patients),
    (model) => model.open(patientId),
  );

  return (
    <>
      <header className="page-header">
        <div className="copilot-heading">
          <h1>{vm.labels.title}</h1>
          {vm.labels.scope ? <Badge tone="ai">{vm.labels.scope}</Badge> : null}
        </div>
        <p className="muted with-icon">
          <Globe size={16} aria-hidden="true" />
          {session.t('copilot.languageNote')}
        </p>
      </header>
      <div className={vm.opened ? 'copilot-grid copilot-grid-open' : 'copilot-grid'}>
        <Card className="copilot-chat">
          <Conversation vm={vm} />
          <p className="muted small">{vm.labels.disclaimer}</p>
          <Composer vm={vm} />
        </Card>
        <SourcePanel vm={vm} patientId={patientId} />
      </div>
    </>
  );
});
