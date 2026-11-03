'use client';

import { observer } from 'mobx-react-lite';
import { Server } from 'lucide-react';
import type { SupervisionViewModel } from '@hygia/view-models';

/** Grille des 8 services : état, zones a/b (pastilles vertes ou rouges) et p95 mesuré par le broker. */
export const ServiceGrid = observer(function ServiceGrid({ vm }: { vm: SupervisionViewModel }) {
  return (
    <ul className="supervision-grid">
      {vm.cards.map((card) => (
        <li key={card.id} className="card supervision-service" data-testid={`service-${card.id}`}>
          <div className="supervision-service-head">
            <Server size={16} strokeWidth={1.75} aria-hidden="true" />
            <strong>{card.name}</strong>
            <span
              className={`supervision-dot supervision-dot-${card.status}`}
              role="img"
              aria-label={card.statusLabel}
              title={card.statusLabel}
            />
          </div>
          <p className="muted">{card.runtime}</p>
          <div className="supervision-service-foot">
            <span className="supervision-zones">
              {card.zones.map((zone) => (
                <span
                  key={zone.id}
                  className={`supervision-zone ${zone.up ? 'supervision-zone-up' : 'supervision-zone-down'}`}
                  title={zone.title}
                  data-up={zone.up}
                >
                  {zone.label}
                </span>
              ))}
            </span>
            <span className={card.slow ? 'supervision-p95 supervision-p95-slow' : 'supervision-p95'}>
              {card.p95Label}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
});
