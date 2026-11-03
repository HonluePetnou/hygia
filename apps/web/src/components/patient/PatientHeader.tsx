'use client';

import Link from 'next/link';
import { Download, Mic, Sparkles } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { PatientRecordViewModel } from '@hygia/view-models';
import { Avatar, Badge, Button, Card } from '@/components/ui';
import { downloadFile } from '@/lib/download-file';
import { useSession } from '@/lib/session-context';

/** Onglets du dossier ; seuls ceux qui portent un `id` sont disponibles pour l'instant. */
const TABS: readonly { key: string; id?: PatientTab }[] = [
  { key: 'patient.tab.timeline', id: 'timeline' },
  { key: 'patient.tab.summary' },
  { key: 'patient.tab.documents' },
  { key: 'patient.tab.prescriptions' },
  { key: 'patient.tab.vitals' },
  { key: 'patient.tab.versions', id: 'versions' },
  { key: 'patient.tab.access' },
];

/** Onglets actifs du dossier. */
export type PatientTab = 'timeline' | 'versions';

/** En-tête du dossier : avatar, nom, badges d'alerte, identité, actions et onglets. */
export const PatientHeader = observer(function PatientHeader({
  vm,
  tab,
  onTab,
  onDictate,
}: {
  vm: PatientRecordViewModel;
  tab: PatientTab;
  onTab: (tab: PatientTab) => void;
  /** Ouvre le scribe ; le bouton « Dicter » n'apparaît que s'il est fourni (et pour un médecin). */
  onDictate?: () => void;
}) {
  const session = useSession();
  const { t } = session;
  return (
    <Card className="record-header">
      <div className="record-identity">
        <Avatar name={vm.fullName} />
        <div>
          <div className="record-name">
            <h1>{vm.fullName}</h1>
            {vm.badges.map((badge) => (
              <Badge key={badge.id} tone={badge.tone}>
                {badge.label}
              </Badge>
            ))}
          </div>
          <p className="muted">{vm.identityLine}</p>
          {vm.exportFailed ? <p role="alert">{t('export.error')}</p> : null}
        </div>
        <div className="page-actions">
          <Button
            variant="secondary"
            onClick={() =>
              void vm.exportPdf().then((file) => {
                if (file !== null) downloadFile(file);
              })
            }
          >
            <Download size={16} aria-hidden="true" />
            {t('patient.exportPdf')}
          </Button>
          {onDictate !== undefined && session.identity.role === 'medecin' ? (
            <Button variant="secondary" onClick={onDictate}>
              <Mic size={16} aria-hidden="true" />
              {t('scribe.dictate')}
            </Button>
          ) : null}
          <Link href="/copilote" className="btn btn-ai">
            <Sparkles size={16} aria-hidden="true" />
            {t('patient.askCopilot')}
          </Link>
        </div>
      </div>
      <div className="record-tabs" role="tablist" aria-label={t('patient.tabs')}>
        {TABS.map(({ key, id }) => {
          const selected = id !== undefined && id === tab;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-disabled={id === undefined ? true : undefined}
              tabIndex={selected ? 0 : -1}
              className="record-tab"
              onClick={id === undefined ? undefined : () => onTab(id)}
            >
              {t(key)}
            </button>
          );
        })}
      </div>
    </Card>
  );
});
