'use client';

import { FileUp } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useRef, useState, type DragEvent } from 'react';
import type { IngestionViewModel } from '@hygia/view-models';
import { Button } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Zone de dépôt (glisser-déposer ou « Parcourir ») : l'import démarre dès qu'un fichier est choisi. */
export const DropZone = observer(function DropZone({ vm }: { vm: IngestionViewModel }) {
  const { t } = useSession();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const receive = (file: File | undefined) => {
    if (!file) return;
    vm.chooseFile({ name: file.name, size: file.size, content: file });
    void vm.start();
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    receive(event.dataTransfer.files[0]);
  };

  return (
    <div
      className={over ? 'drop-zone drop-zone-over' : 'drop-zone'}
      data-testid="drop-zone"
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <span className="drop-icon" aria-hidden="true">
        <FileUp size={24} />
      </span>
      <p className="drop-title">{t('import.drop.title')}</p>
      <p className="muted small">{t('import.drop.hint')}</p>
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-label={t('import.browse')}
        accept=".pdf,.png,.jpg,.jpeg,.csv,.json"
        onChange={(event) => receive(event.target.files?.[0])}
      />
      <Button disabled={vm.running} onClick={() => input.current?.click()}>
        {t('import.browse')}
      </Button>
    </div>
  );
});
