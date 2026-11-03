'use client';

import { useEffect, useRef } from 'react';
import { Eye, ShieldCheck, Timer, Zap } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { BreakGlassViewModel } from '@hygia/view-models';
import { Button } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Fenêtre modale de bris de glace : motif, précisions obligatoires, mentions légales. */
export const BreakGlassDialog = observer(function BreakGlassDialog({
  vm,
}: {
  vm: BreakGlassViewModel;
}) {
  const { t } = useSession();
  const firstRadio = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (vm.isOpen) firstRadio.current?.focus();
  }, [vm.isOpen]);

  if (!vm.isOpen) return null;
  return (
    <div className="modal-backdrop" onKeyDown={(event) => event.key === 'Escape' && vm.close()}>
      <div role="dialog" aria-modal="true" aria-labelledby="break-glass-title" className="modal">
        <span className="icon-chip icon-chip-warning" aria-hidden="true">
          <Zap size={20} />
        </span>
        <h2 id="break-glass-title">{t('breakGlass.title')}</h2>
        <p className="muted">{t('breakGlass.intro')}</p>

        <fieldset className="reason-group">
          <legend className="field-label">{t('breakGlass.reason')}</legend>
          {vm.reasons.map((reason, index) => (
            <label key={reason.id} className={reason.selected ? 'reason is-selected' : 'reason'}>
              <input
                ref={index === 0 ? firstRadio : undefined}
                type="radio"
                name="break-glass-reason"
                checked={reason.selected}
                onChange={() => vm.setReason(reason.id)}
              />
              {reason.label}
            </label>
          ))}
        </fieldset>

        <div className="field">
          <label className="field-label" htmlFor="break-glass-details">
            {t('breakGlass.details')}
          </label>
          <textarea
            id="break-glass-details"
            className="input textarea"
            rows={3}
            required
            value={vm.precisions}
            onChange={(event) => vm.setPrecisions(event.target.value)}
          />
        </div>

        <ul className="modal-notes">
          <li>
            <Timer size={14} aria-hidden="true" />
            {t('breakGlass.note.duration')}
          </li>
          <li>
            <ShieldCheck size={14} aria-hidden="true" />
            {t('breakGlass.note.dpo')}
          </li>
          <li>
            <Eye size={14} aria-hidden="true" />
            {t('breakGlass.note.patient')}
          </li>
        </ul>

        {vm.failed ? <p role="alert">{t('breakGlass.error')}</p> : null}
        <div className="modal-actions">
          <Button variant="secondary" onClick={vm.close}>
            {t('breakGlass.cancel')}
          </Button>
          <Button variant="danger" disabled={!vm.canSubmit} onClick={() => void vm.submit()}>
            <Zap size={16} aria-hidden="true" />
            {t('breakGlass.submit')}
          </Button>
        </div>
      </div>
    </div>
  );
});
