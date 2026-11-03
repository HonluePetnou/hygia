import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { demoDataset } from '@hygia/fhir';
import { InMemoryPatientsGateway, SessionViewModel } from '@hygia/view-models';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MergeScreen } from '@/components/patients/MergeScreen';
import { PatientsScreen } from '@/components/patients/PatientsScreen';
import { GatewayProvider } from '@/lib/gateway-context';
import { SessionProvider } from '@/lib/session-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/',
}));

function setup(gateway: InMemoryPatientsGateway, children: ReactNode) {
  const session = new SessionViewModel();
  return render(
    <SessionProvider session={session}>
      <GatewayProvider gateway={gateway}>{children}</GatewayProvider>
    </SessionProvider>,
  );
}

describe('doublons d’identité', () => {
  it('affiche le bandeau sur /patients et le retire quand on ignore', async () => {
    const gateway = new InMemoryPatientsGateway(demoDataset);
    setup(gateway, <PatientsScreen />);
    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent(/Doublon d’identité probable/);
    expect(banner).toHaveTextContent('HYG-2025-01544');
    expect(banner).toHaveTextContent('CMA de Bépanda');
    expect(within(banner).getByRole('link', { name: 'Comparer et fusionner' })).toBeVisible();
    await userEvent.click(within(banner).getByRole('button', { name: 'Ignorer' }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(await gateway.duplicates()).toHaveLength(0);
  });

  it('compare champ par champ, demande confirmation, fusionne puis annule', async () => {
    const gateway = new InMemoryPatientsGateway(demoDataset);
    const [pair] = await gateway.duplicates();
    setup(gateway, <MergeScreen duplicateId={pair?.id as string} />);

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Nom').closest('tr')).toHaveClass('is-changed');
    expect(within(table).getByText('Date de naissance').closest('tr')).not.toHaveClass('is-changed');
    await userEvent.click(screen.getByRole('radio', { name: /Garder « BASSA NGO » pour Nom/ }));

    await userEvent.click(screen.getByRole('button', { name: 'Fusionner les dossiers' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('HYG-2025-01544');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmer la fusion' }));

    expect(await screen.findByText(/Dossiers fusionnés/)).toBeVisible();
    expect(await gateway.search('Florence')).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Annuler la fusion' }));
    expect(await screen.findByText(/Fusion annulée/)).toBeVisible();
    expect(await gateway.search('Florence')).toHaveLength(2);
  });

  it('signale un doublon qui n’existe plus', async () => {
    setup(new InMemoryPatientsGateway(demoDataset), <MergeScreen duplicateId="inconnu" />);
    expect(await screen.findByText(/n’existe plus/)).toBeVisible();
  });
});
