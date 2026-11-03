import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { demoDataset } from '@hygia/fhir';
import { InMemoryPatientsGateway, SessionViewModel } from '@hygia/view-models';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AlertsScreen } from '@/components/alertes/AlertsScreen';
import { DashboardScreen } from '@/components/dashboard/DashboardScreen';
import { Sidebar } from '@/components/shell/Sidebar';
import { GatewayProvider } from '@/lib/gateway-context';
import { SessionProvider } from '@/lib/session-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/alertes',
}));

function setup(gateway: InMemoryPatientsGateway, children: ReactNode) {
  return render(
    <SessionProvider session={new SessionViewModel()}>
      <GatewayProvider gateway={gateway}>{children}</GatewayProvider>
    </SessionProvider>,
  );
}

describe('écran Alertes IA', () => {
  it('affiche la liste, le raisonnement en 4 étapes, les sources et la proposition', async () => {
    setup(new InMemoryPatientsGateway(demoDataset), <AlertsScreen />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Alertes IA' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Ouvertes · 4' })).toHaveAttribute('aria-selected', 'true');
    const list = screen.getByRole('list', { name: 'Liste des alertes' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(await screen.findByRole('heading', { level: 2, name: /warfarine × ibuprofène/ })).toBeVisible();
    expect(screen.getByText('Critique')).toBeVisible();
    expect(screen.getByText('Agent de pharmacovigilance')).toBeVisible();
    expect(screen.getByText(/Nouvelle prescription reçue/)).toBeVisible();
    expect(screen.getByText(/Contexte patient pris en compte/)).toBeVisible();
    expect(screen.getByText(/1 · Ordonnance WhatsApp/)).toBeVisible();
    expect(screen.getByText('Proposition de l’agent', { exact: false })).toBeVisible();
    expect(screen.getByText(/Précision de l’agent sur 30 jours/)).toBeVisible();
  });

  it('refuse un rejet sans justification, puis rejette avec justification', async () => {
    const user = userEvent.setup();
    const gateway = new InMemoryPatientsGateway(demoDataset);
    setup(gateway, <AlertsScreen />);
    await screen.findByRole('heading', { level: 2, name: /warfarine/ });

    await user.click(screen.getByRole('button', { name: 'Rejeter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('justification est obligatoire');
    expect(await gateway.alerts('rejetees')).toHaveLength(0);

    await user.type(screen.getByLabelText(/Justification/), 'AINS arrêté');
    await user.click(screen.getByRole('button', { name: 'Rejeter' }));
    expect(await screen.findByRole('tab', { name: 'Ouvertes · 3' })).toBeVisible();
    expect(await gateway.alerts('rejetees')).toHaveLength(1);

    await user.click(screen.getByRole('tab', { name: 'Rejetées' }));
    expect(await screen.findByText('Justification : AINS arrêté')).toBeVisible();
  });

  it('« Accepter et notifier le prescripteur » enregistre la décision', async () => {
    const user = userEvent.setup();
    const gateway = new InMemoryPatientsGateway(demoDataset);
    setup(gateway, <AlertsScreen />);
    await screen.findByRole('heading', { level: 2, name: /warfarine/ });
    await user.click(screen.getByRole('button', { name: 'Accepter et notifier le prescripteur' }));
    await user.click(await screen.findByRole('tab', { name: 'Acceptées' }));
    expect(await screen.findByText(/prescripteur a été notifié/)).toBeVisible();
  });
});

describe('alertes ouvertes : barre latérale et tableau de bord', () => {
  it('le compteur de la barre latérale reflète les alertes ouvertes', async () => {
    setup(new InMemoryPatientsGateway(demoDataset), <Sidebar />);
    expect(await screen.findByTestId('nav-alerts-count')).toHaveTextContent('4');
  });

  it('la carte du tableau de bord liste les alertes ouvertes', async () => {
    setup(new InMemoryPatientsGateway(demoDataset), <DashboardScreen />);
    await screen.findByRole('heading', { level: 1 });
    const card = (await screen.findByRole('heading', { name: 'Alertes IA' })).closest('.card') as HTMLElement;
    expect(within(card).getByText('4 ouvertes')).toBeVisible();
    expect(within(card).getAllByRole('link')).toHaveLength(4);
  });
});
