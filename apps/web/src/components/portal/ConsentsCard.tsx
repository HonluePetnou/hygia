'use client';

import { observer } from 'mobx-react-lite';
import { REQUIRED_CONSENT, type PortalViewModel } from '@hygia/view-models';
import { Badge } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** « Mes consentements » : interrupteurs par finalité ; les soins sont requis et verrouillés. */
export const ConsentsCard = observer(function ConsentsCard({ vm }: { vm: PortalViewModel }) {
  const { t } = useSession();
  return (
    <section
      className="card portal-consents"
      id="consentements"
      aria-labelledby="portal-consents-title"
    >
      <h2 id="portal-consents-title">{t('portal.consents.title')}</h2>
      <p className="muted small">{t('portal.consents.subtitle')}</p>
      <ul className="portal-consent-list">
        {vm.purposes.map((purpose) => {
          const consent = vm.consentOf(purpose);
          const required = purpose === REQUIRED_CONSENT;
          return (
            <li key={purpose} className="portal-consent">
              <div>
                <strong id={`consent-${purpose}`}>{t(`portal.consent.${purpose}`)}</strong>
                <p className="muted small">{t(`portal.consent.${purpose}.desc`)}</p>
              </div>
              {required ? (
                <Badge>{t('portal.consents.required')}</Badge>
              ) : (
                <button
                  type="button"
                  role="switch"
                  className="portal-switch"
                  aria-checked={consent?.granted ?? false}
                  aria-labelledby={`consent-${purpose}`}
                  disabled={consent === undefined}
                  onClick={() => void vm.toggleConsent(purpose)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
});
