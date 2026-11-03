'use client';

import { observer } from 'mobx-react-lite';
import type { PortalViewModel } from '@hygia/view-models';
import { useSession } from '@/lib/session-context';
import { formatAppointment } from './format';

/** Bandeau « Bonjour … » et prochain rendez-vous (maquette 13). */
export const PortalHero = observer(function PortalHero({ vm }: { vm: PortalViewModel }) {
  const { t, locale } = useSession();
  const appointment = vm.appointment;
  const detail = appointment
    ? [appointment.clinician, appointment.service, appointment.site].filter(Boolean).join(' · ')
    : '';
  return (
    <section className="portal-hero" id="mon-dossier" aria-labelledby="portal-hello">
      <div>
        <h1 id="portal-hello">{t('portal.hello', { name: vm.firstName })}</h1>
        <p>{t('portal.intro')}</p>
      </div>
      <div className="portal-next" id="rendez-vous">
        <small>{t('portal.next.label')}</small>
        {appointment ? (
          <>
            <strong>{formatAppointment(appointment.startsAt, locale)}</strong>
            {detail ? <span>{detail}</span> : null}
          </>
        ) : (
          <strong>{t('portal.next.none')}</strong>
        )}
      </div>
    </section>
  );
});
