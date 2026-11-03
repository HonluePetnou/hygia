import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InMemorySupervisionGateway, SessionViewModel } from '@hygia/view-models';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from '@/components/shell/Sidebar';
import { SupervisionScreen } from '@/components/supervision/SupervisionScreen';
import { GatewayProvider } from '@/lib/gateway-context';
import { SessionProvider } from '@/lib/session-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/supervision',
}));

function setup(gateway = new InMemorySupervisionGateway()) {
  return render(
    <SessionProvider session={new SessionViewModel({ role: 'admin' })}>
      <GatewayProvider supervision={gateway}>
        <Sidebar />
        <SupervisionScreen />
      </GatewayProvider>
    </SessionProvider>,
  );
}

describe('écran Supervision', () => {
  it('affiche les 8 services avec leurs zones et leur p95, la courbe et les 4 expériences', async () => {
    setup();
    expect(await screen.findByRole('heading', { level: 1, name: 'Supervision' })).toBeVisible();
    expect(screen.getAllByTestId(/^service-/)).toHaveLength(8);
    const dossiers = screen.getByTestId('service-dossiers');
    expect(dossiers).toHaveTextContent('Dossiers patients');
    expect(dossiers).toHaveTextContent('p95 182 ms');
    expect(within(dossiers).getByText('3a')).toBeVisible();
    expect(within(dossiers).getByText('3b')).toBeVisible();
    expect(screen.getByTestId('service-ia-clinique')).toHaveTextContent('p95 1,4 s');
    expect(screen.getByRole('img', { name: 'Courbe de la latence p95 d’ouverture d’un dossier' })).toBeVisible();
    expect(screen.getByText('SLO respecté')).toBeVisible();
    expect(screen.getAllByRole('button', { name: /^Lancer/ })).toHaveLength(4);
    expect(screen.queryByText('Arrêter l’exercice')).not.toBeInTheDocument();
  });

  it('couper une zone : bandeau, zones 3a en rouge, puis « Arrêter l’exercice »', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByTestId('service-dossiers');
    await user.click(screen.getByRole('button', { name: 'Lancer : Couper une zone de disponibilité' }));
    const banner = await screen.findByRole('status', { name: 'Zone eu-west-3a coupée depuis 10:14' });
    expect(banner).toHaveTextContent('0 erreur côté utilisateur');
    expect(screen.getByText('Exercice de panne en cours')).toBeVisible();
    expect(within(screen.getByTestId('service-dossiers')).getByText('3a')).toHaveAttribute('data-up', 'false');
    expect(within(screen.getByTestId('service-dossiers')).getByText('3b')).toHaveAttribute('data-up', 'true');
    expect(screen.getByText('En cours')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Arrêter l’exercice' }));
    expect(screen.queryByRole('status', { name: /coupée/ })).not.toBeInTheDocument();
    expect(within(screen.getByTestId('service-dossiers')).getByText('3a')).toHaveAttribute('data-up', 'true');
  });

  it('réduit la barre latérale de l’administrateur à la section Conformité', async () => {
    setup();
    await screen.findByTestId('service-dossiers');
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Comptes et rôles', 'Supervision']);
  });

  it('refuse l’accès (403) avec un message', async () => {
    const { GatewayError } = await import('@hygia/view-models');
    const denied = new InMemorySupervisionGateway();
    denied.load = () => Promise.reject(new GatewayError(403, 'GET'));
    setup(denied);
    expect(await screen.findByRole('alert')).toHaveTextContent('réservée à l’administrateur système');
  });
});
