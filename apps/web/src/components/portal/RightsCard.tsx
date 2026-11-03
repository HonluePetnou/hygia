'use client';

import { useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { PortalViewModel } from '@hygia/view-models';
import { Button } from '@/components/ui';
import { downloadFile } from '@/lib/download-file';
import { useSession } from '@/lib/session-context';

type Pending = 'rectification' | 'suppression';

/** « Mes droits » : téléchargement du dossier, rectification et suppression (traitées par la DPO). */
export const RightsCard = observer(function RightsCard({ vm }: { vm: PortalViewModel }) {
  const { t } = useSession();
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState('');
  const onDownload = async () => {
    const file = await vm.downloadDossier();
    if (file !== null) downloadFile(file);
  };
  const onSend = async () => {
    if (pending === null) return;
    await vm.request(pending, message.trim());
    setPending(null);
    setMessage('');
  };
  return (
    <section className="card portal-rights" id="droits" aria-labelledby="portal-rights-title">
      <h2 id="portal-rights-title">{t('portal.rights.title')}</h2>
      <p className="muted small">{t('portal.rights.subtitle')}</p>
      <div className="portal-rights-actions">
        <Button variant="secondary" block onClick={() => void onDownload()}>
          <Download size={16} aria-hidden="true" /> {t('portal.rights.download')}
        </Button>
        <Button variant="secondary" block onClick={() => setPending('rectification')}>
          <FileText size={16} aria-hidden="true" /> {t('portal.rights.rectification')}
        </Button>
        <button type="button" className="portal-danger" onClick={() => setPending('suppression')}>
          <X size={16} aria-hidden="true" /> {t('portal.rights.suppression')}
        </button>
      </div>
      {pending !== null ? (
        <form
          className="portal-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onSend();
          }}
        >
          <label htmlFor="portal-rights-message">{t('portal.rights.message.label')}</label>
          <textarea
            id="portal-rights-message"
            rows={3}
            maxLength={2000}
            required
            value={message}
            placeholder={t('portal.rights.message.placeholder')}
            onChange={(event) => setMessage(event.target.value)}
          />
          <div className="portal-form-actions">
            <Button type="submit" disabled={message.trim() === ''}>
              {t('portal.rights.send')}
            </Button>
            <Button variant="ghost" onClick={() => setPending(null)}>
              {t('portal.rights.cancel')}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
});
