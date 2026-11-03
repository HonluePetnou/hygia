'use client';

import { observer } from 'mobx-react-lite';
import type { SupervisionViewModel } from '@hygia/view-models';
import { Button } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Expériences de pannes (RF27) : une ligne par expérience, bouton Lancer / Arrêter. */
export const ExperimentList = observer(function ExperimentList({ vm }: { vm: SupervisionViewModel }) {
  const { t } = useSession();
  return (
    <section className="card supervision-experiments" aria-labelledby="supervision-experiments-title">
      <h2 id="supervision-experiments-title">{t('supervision.experiments.title')}</h2>
      <p className="muted">{t('supervision.experiments.subtitle')}</p>
      <ul className="supervision-experiment-list">
        {vm.experiments.map((experiment) => (
          <li
            key={experiment.id}
            className={experiment.active ? 'supervision-experiment supervision-experiment-active' : 'supervision-experiment'}
          >
            <div>
              <strong>{experiment.label}</strong>
              <p className="muted">{experiment.detail}</p>
            </div>
            {experiment.active ? <span className="supervision-running">{t('supervision.running')}</span> : null}
            <Button
              variant="secondary"
              disabled={vm.busy !== null}
              aria-label={`${experiment.active ? t('supervision.stop') : t('supervision.launch')} : ${experiment.label}`}
              onClick={() => void vm.toggle(experiment.id)}
            >
              {experiment.active ? t('supervision.stop') : t('supervision.launch')}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
});
