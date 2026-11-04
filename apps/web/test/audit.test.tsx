import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InMemoryAuditGateway, SessionViewModel } from '@hygia/view-models';
import { describe, expect, it, vi } from 'vitest';
import { AuditScreen } from '@/components/audit/AuditScreen';
import { Sidebar } from '@/components/shell/Sidebar';
import { GatewayProvider } from '@/lib/gateway-context';
import { SessionProvider } from '@/lib/session-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/audit',
}));

function setup(gateway = new InMemoryAuditGateway(), role: 'auditeur' | 'medecin' = 'auditeur') {
  return render(
    <SessionProvider session={new SessionViewModel({ role })}>
      <GatewayProvider audit={gateway}>
        <Sidebar />
        <AuditScreen />
      </GatewayProvider>
    </SessionProvider>,
  );
}

describe('écran Journal d’audit', () => {
  it('affiche le badge, les indicateurs, le chaînage et le tableau', async () => {
    setup();
    expect(await screen.findByRole('heading', { level: 1, name: 'Journal d’audit' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Chaîne intègre · vérifiée à 04:00');
    expect(screen.getByTestId('audit-events')).toHaveTextContent('7');
    expect(screen.getByTestId('audit-breakGlass')).toHaveTextContent('1');
    expect(screen.getByTestId('audit-breaks')).toHaveTextContent('0');
    const chain = screen.getByRole('region', { name: 'Chaînage des entrées' });
    expect(within(chain).getAllByRole('listitem')).toHaveLength(3);
    const table = screen.getByRole('table', { name: 'Entrées du journal d’audit' });
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Lamport', 'Horodatage', 'Acteur', 'Action', 'Ressource', 'Motif', 'Hachage',
    ]);
    const breakGlassRow = within(table).getByText('Dr B. Ondoa').closest('tr') as HTMLElement;
    expect(breakGlassRow).toHaveClass('audit-row-alert');
  });

  it('filtre par puce et par recherche', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Bris de glace' }));
    expect(await screen.findAllByRole('row')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Tous' }));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(await screen.findByText('Aucune entrée ne correspond à ces filtres.')).toBeVisible();
  });

  it('signale une rupture de chaîne', async () => {
    setup(new InMemoryAuditGateway(undefined, undefined, false));
    expect(await screen.findByRole('status')).toHaveTextContent('Rupture de chaîne à l’entrée 1');
    expect(screen.getByTestId('audit-breaks')).toHaveTextContent('1');
  });

  it('réduit la barre latérale de l’auditeur à Conformité', async () => {
    setup();
    await screen.findByRole('table');
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(["Journal d'audit"]);
    expect(within(nav).getByText('Conformité')).toBeVisible();
  });

  it('affiche l’accès refusé pour un médecin', async () => {
    const { GatewayError } = await import('@hygia/view-models');
    const refused = new InMemoryAuditGateway();
    refused.summary = () => Promise.reject(new GatewayError(403, 'GET /summary'));
    setup(refused, 'medecin');
    expect(await screen.findByRole('alert')).toHaveTextContent('Cet écran est réservé à l’auditeur.');
  });
});
