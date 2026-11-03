'use client';

import Link from 'next/link';
import { Download, Sparkles } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { PatientRecordViewModel } from '@hygia/view-models';
import { Avatar, Badge, Button, Card } from '@/components/ui';
import { useSession } from '@/lib/session-context';

const TABS = [
  'patient.tab.timeline',
  'patient.tab.summary',
  'patient.tab.documents',
  'patient.tab.prescriptions',
  'patient.tab.vitals',
  'patient.tab.versions',
  'patient.tab.access',
] as const;

/** En-tête du dossier : avatar, nom, badges d'alerte, identité, actions et onglets. */
export const PatientHeader = observer(function PatientHeader({
  vm,
}: {
  vm: PatientRecordViewModel;
}) {
  const { t } = useSession();
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
        </div>
        <div className="page-actions">
          <Button variant="secondary" onClick={() => window.print()}>
            <Download size={16} aria-hidden="true" />
            {t('patient.exportPdf')}
          </Button>
          <Link href="/copilote" className="btn btn-ai">
            <Sparkles size={16} aria-hidden="true" />
            {t('patient.askCopilot')}
          </Link>
        </div>
      </div>
      <div className="record-tabs" role="tablist" aria-label={t('patient.tabs')}>
        {TABS.map((key, index) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={index === 0}
            aria-disabled={index === 0 ? undefined : true}
            tabIndex={index === 0 ? 0 : -1}
            className="record-tab"
          >
            {t(key)}
          </button>
        ))}
      </div>
    </Card>
  );
});
