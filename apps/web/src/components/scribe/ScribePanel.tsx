'use client';

import { useEffect, useMemo } from 'react';
import { Check, Mic, Sparkles, Square } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { ScribeViewModel, type AudioRecorder } from '@hygia/view-models';
import { Badge, Button, Card } from '@/components/ui';
import { useScribeGateway } from '@/lib/gateway-context';
import { useSession } from '@/lib/session-context';

/** Fabrique du micro ; remplacée dans les tests. */
export type RecorderFactory = () => AudioRecorder;

const WAVE_BARS = 24;

/** Onde animée : la hauteur des barres suit le niveau sonore. */
function Wave({ level }: { level: number }) {
  return (
    <div className="scribe-wave" aria-hidden="true">
      {Array.from({ length: WAVE_BARS }, (_, i) => (
        <span key={i} style={{ height: `${10 + level * 90 * Math.abs(Math.sin(i * 1.7))}%` }} />
      ))}
    </div>
  );
}

/** Panneau « Dicter » du dossier : enregistrement, brouillon à valider, correction (maquette 18). */
export const ScribePanel = observer(function ScribePanel({
  patientId,
  createRecorder,
  onClose,
}: {
  patientId: string;
  createRecorder: RecorderFactory;
  onClose: () => void;
}) {
  const session = useSession();
  const gateway = useScribeGateway();
  const { t } = session;
  const vm = useMemo(
    () => new ScribeViewModel(patientId, gateway, createRecorder(), session),
    [patientId, gateway, createRecorder, session],
  );

  useEffect(() => {
    const timer = setInterval(() => vm.tick(), 200);
    return () => clearInterval(timer);
  }, [vm]);

  return (
    <Card className="scribe-panel" aria-label={t('scribe.title')}>
      <div className="scribe-head">
        <h2>{t('scribe.title')}</h2>
        <Button variant="secondary" onClick={onClose}>
          ×<span className="sr-only">{t('scribe.close')}</span>
        </Button>
      </div>
      {vm.errorMessage !== '' ? <p role="alert">{vm.errorMessage}</p> : null}
      {vm.state === 'idle' ? (
        <Button onClick={() => void vm.start()}>
          <Mic size={16} aria-hidden="true" />
          {t('scribe.start')}
        </Button>
      ) : null}
      {vm.state === 'recording' ? (
        <div className="scribe-recording">
          <p>
            <span className="scribe-dot" aria-hidden="true" />
            {`${t('scribe.recording')} · `}
            <time>{vm.durationLabel}</time>
          </p>
          <Wave level={vm.level} />
          <p className="muted">{t('scribe.consentNotice')}</p>
          <Button onClick={() => void vm.stop()}>
            <Square size={16} aria-hidden="true" />
            {t('scribe.stop')}
          </Button>
        </div>
      ) : null}
      {vm.state === 'processing' || vm.state === 'saving' ? (
        <p role="status">{t('scribe.processing')}</p>
      ) : null}
      {vm.state === 'draft' || vm.state === 'saving' ? <Draft vm={vm} /> : null}
      {vm.state === 'validated' || vm.state === 'rejected' ? (
        <div>
          <p role="status">{vm.outcomeMessage}</p>
          <Button variant="secondary" onClick={() => vm.reset()}>
            {t('scribe.newConsultation')}
          </Button>
        </div>
      ) : null}
    </Card>
  );
});

const Draft = observer(function Draft({ vm }: { vm: ScribeViewModel }) {
  const { t } = useSession();
  const busy = vm.state === 'saving';
  return (
    <section className="scribe-draft" aria-label={t('scribe.draftTitle')}>
      <header>
        <Sparkles size={16} aria-hidden="true" />
        <h3>{t('scribe.draftTitle')}</h3>
        <Badge tone="ai">{t('scribe.toValidate')}</Badge>
      </header>
      {vm.sections.map((section) => (
        <div key={section.key}>
          <h4>{section.title}</h4>
          {vm.editing && section.editable && (section.key === 'motif' || section.key === 'examen') ? (
            <textarea
              aria-label={section.title}
              value={vm.draft?.[section.key] ?? ''}
              onChange={(event) => vm.setText(section.key as 'motif' | 'examen', event.target.value)}
            />
          ) : section.lines.length === 0 ? (
            <p className="muted">{t('scribe.nothing')}</p>
          ) : (
            section.lines.map((line) => <p key={line}>{line}</p>)
          )}
        </div>
      ))}
      <div className="scribe-actions">
        <Button variant="secondary" disabled={busy} onClick={() => vm.toggleEditing()}>
          {vm.editing ? t('scribe.doneCorrecting') : t('scribe.correct')}
        </Button>
        <Button disabled={busy} onClick={() => void vm.validate()}>
          <Check size={16} aria-hidden="true" />
          {t('scribe.validate')}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => void vm.reject()}>
          {t('scribe.reject')}
        </Button>
      </div>
      <p className="muted">{t('scribe.noPersist')}</p>
    </section>
  );
});
