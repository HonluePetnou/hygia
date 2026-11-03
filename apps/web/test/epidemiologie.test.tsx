import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InMemoryEpidemiologyGateway, SessionViewModel } from '@hygia/view-models';
import { describe, expect, it, vi } from 'vitest';
import { EpidemiologyScreen } from '@/components/epidemiologie/EpidemiologyScreen';
import { Sidebar } from '@/components/shell/Sidebar';
import { GatewayProvider } from '@/lib/gateway-context';
import { SessionProvider } from '@/lib/session-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/epidemiologie',
}));

function setup(gateway: InMemoryEpidemiologyGateway, role: 'analyste' | 'medecin' = 'analyste') {
  return render(
    <SessionProvider session={new SessionViewModel({ role })}>
      <GatewayProvider epidemiology={gateway}>
        <Sidebar />
        <EpidemiologyScreen />
      </GatewayProvider>
    </SessionProvider>,
  );
}

describe('écran Veille épidémiologique', () => {
  it('affiche la carte, le foyer de Mora, la courbe et le classement', async () => {
    setup(new InMemoryEpidemiologyGateway());
    expect(await screen.findByRole('heading', { level: 1, name: 'Veille épidémiologique' })).toBeVisible();
    expect(screen.getByText('Données pseudonymisées')).toBeVisible();
    expect(await screen.findByRole('heading', { level: 2, name: 'Choléra · semaine 44' })).toBeVisible();
    const map = screen.getByRole('group', { name: /Carte du Cameroun/ });
    expect(within(map).getByRole('img', { name: /Mora : 14 cas · Foyer anormal/ })).toBeInTheDocument();
    expect(screen.getByText('Foyer anormal détecté')).toBeVisible();
    expect(screen.getByText(/14 cas cette semaine pour 3\.2 attendus/)).toBeVisible();
    expect(screen.getByRole('img', { name: /Courbe des cas hebdomadaires de Mora/ })).toBeVisible();
    const list = screen.getByRole('heading', { name: 'Districts les plus touchés' }).parentElement as HTMLElement;
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Mora14 cas');
  });

  it('change de pathologie, de période et de région', async () => {
    const user = userEvent.setup();
    setup(new InMemoryEpidemiologyGateway());
    await screen.findByRole('heading', { level: 2, name: 'Choléra · semaine 44' });
    await user.click(screen.getByRole('button', { name: 'Paludisme' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Paludisme · semaine 44' })).toBeVisible();
    expect(screen.getByText('Aucun foyer anormal cette semaine pour ce filtre.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Dengue' }));
    expect(await screen.findByRole('img', { name: /Douala : 4 cas · Hausse à surveiller/ })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Période'), '2');
    expect(await screen.findByRole('heading', { level: 2, name: 'Dengue · semaine 42' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Choléra' }));
    await user.selectOptions(screen.getByLabelText('Région'), 'littoral');
    expect(screen.queryByRole('img', { name: /Mora/ })).not.toBeInTheDocument();
  });

  it('montre une info-bulle au survol', async () => {
    const user = userEvent.setup();
    setup(new InMemoryEpidemiologyGateway());
    const bubble = await screen.findByRole('img', { name: /Mora : 14 cas/ });
    await user.hover(bubble);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Mora : 14 cas · Foyer anormal');
  });

  it('intègre un cas arrivé en direct', async () => {
    const gateway = new InMemoryEpidemiologyGateway();
    setup(gateway);
    await screen.findByRole('img', { name: /Mora : 14 cas/ });
    expect(screen.getByTestId('live-status')).toHaveTextContent('Temps réel');
    act(() => gateway.push({ pathology: 'choléra', district: 'Mora', week: '2026-W44' }));
    expect(await screen.findByRole('img', { name: /Mora : 15 cas/ })).toBeInTheDocument();
    expect(screen.getByTestId('live-count')).toHaveTextContent('1 nouveaux cas reçus');
  });

  it('notifie la délégation en publiant l’événement', async () => {
    const user = userEvent.setup();
    const gateway = new InMemoryEpidemiologyGateway();
    setup(gateway);
    await user.click(await screen.findByRole('button', { name: 'Notifier la délégation' }));
    expect(await screen.findByRole('button', { name: 'Délégation notifiée' })).toBeDisabled();
    expect(gateway.notices).toEqual([
      { pathology: 'choléra', district: 'Mora', week: '2026-W44', cases: 14, threshold: 7.1 },
    ]);
  });

  it('limite la barre latérale de l’analyste à la veille', async () => {
    setup(new InMemoryEpidemiologyGateway());
    const nav = await screen.findByRole('navigation', { name: 'Navigation principale' });
    expect(within(nav).getAllByRole('link')).toHaveLength(1);
    expect(within(nav).getByRole('link', { name: 'Carte épidémiologique' })).toBeVisible();
    expect(within(nav).queryByRole('link', { name: 'Patients' })).not.toBeInTheDocument();
  });

  it('garde la barre latérale clinique pour un médecin', async () => {
    setup(new InMemoryEpidemiologyGateway(), 'medecin');
    const nav = await screen.findByRole('navigation', { name: 'Navigation principale' });
    expect(within(nav).getByRole('link', { name: 'Patients' })).toBeVisible();
    expect(within(nav).queryByRole('link', { name: 'Carte épidémiologique' })).not.toBeInTheDocument();
  });
});
