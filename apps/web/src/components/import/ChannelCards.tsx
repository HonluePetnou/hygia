'use client';

import { Link2, MessageCircle, Smartphone, Upload, type LucideIcon } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { IngestionViewModel } from '@hygia/view-models';
import { Card } from '@/components/ui';
import { useSession } from '@/lib/session-context';

const ICONS: Record<string, LucideIcon> = {
  web: Upload,
  mobile: Smartphone,
  fhir: Link2,
  whatsapp: MessageCircle,
};

/** Les quatre canaux d'entrée et le nombre de documents reçus aujourd'hui. */
export const ChannelCards = observer(function ChannelCards({ vm }: { vm: IngestionViewModel }) {
  const { t } = useSession();
  return (
    <Card role="region" aria-labelledby="channels-title">
      <h2 id="channels-title">{t('import.channels.title')}</h2>
      <p className="muted">{t('import.channels.subtitle')}</p>
      <ul className="channel-grid">
        {vm.channels.map((channel) => {
          const Icon = ICONS[channel.id] ?? Upload;
          return (
            <li key={channel.id} className="channel-card">
              <span className={`icon-chip channel-${channel.id}`} aria-hidden="true">
                <Icon size={18} />
              </span>
              <strong>{channel.label}</strong>
              <span className="muted small">{channel.audience}</span>
              <span className="channel-count">{channel.count}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
});
