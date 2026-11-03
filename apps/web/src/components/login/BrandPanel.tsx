'use client';

import { Plus, ShieldCheck, Sparkles, WifiOff, Lock } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useSession } from '@/lib/session-context';

const FEATURES = [
  { key: 'copilot', Icon: Sparkles },
  { key: 'audit', Icon: ShieldCheck },
  { key: 'offline', Icon: WifiOff },
] as const;

/** Panneau de marque (dégradé encre → vert) de l'écran de connexion. */
export const BrandPanel = observer(function BrandPanel() {
  const { t } = useSession();
  return (
    <aside className="brand-panel">
      <div className="brand-logo">
        <span className="brand-mark" aria-hidden="true">
          <Plus size={20} strokeWidth={2.5} />
        </span>
        HYGIA
      </div>
      <div>
        <p className="brand-tagline">{t('brand.tagline')}</p>
        <p className="brand-description">{t('brand.description')}</p>
        <ul className="brand-features">
          {FEATURES.map(({ key, Icon }) => (
            <li key={key} className="brand-feature">
              <span className="brand-feature-icon" aria-hidden="true">
                <Icon size={18} strokeWidth={1.75} />
              </span>
              <div>
                <strong>{t(`brand.feature.${key}.title`)}</strong>
                <span>{t(`brand.feature.${key}.text`)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="brand-compliance">
        <Lock size={16} strokeWidth={1.75} aria-hidden="true" />
        {t('brand.compliance')}
      </p>
    </aside>
  );
});
