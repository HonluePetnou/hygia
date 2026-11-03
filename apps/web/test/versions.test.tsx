import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FLORENCE_ID, demoDataset } from '@hygia/fhir';
import { InMemoryPatientsGateway, SessionViewModel } from '@hygia/view-models';
import { describe, expect, it, vi } from 'vitest';
import { PatientScreen } from '@/components/patient/PatientScreen';
import { GatewayProvider } from '@/lib/gateway-context';
import { SessionProvider } from '@/lib/session-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/',
}));

const doc = (number: number, title: string) => ({
  resourceId: 'd1',
  resourceType: 'DocumentReference' as const,
  number,
  author: number === 1 ? 'système' : 'dr-nana',
  createdAt: `2026-11-0${number}T09:00:00Z`,
  reason: number === 1 ? 'état initial' : 'correction du titre',
  content: { id: 'd1', version: number, title, language: 'fr' },
});

class TwoVersionsGateway extends InMemoryPatientsGateway {
  override versions() {
    return Promise.resolve([doc(2, 'Titre corrigé'), doc(1, 'Titre initial')]);
  }
}

describe('onglet Versions', () => {
  it('liste les versions et compare deux versions avec les champs modifiés surlignés', async () => {
    const session = new SessionViewModel();
    const gateway = new TwoVersionsGateway(demoDataset, () => '2026-10-28', () => ({
      userId: '00000000-0000-4000-8000-020000000001',
      role: 'medecin',
    }));
    render(
      <SessionProvider session={session}>
        <GatewayProvider gateway={gateway}>
          <PatientScreen patientId={FLORENCE_ID} />
        </GatewayProvider>
      </SessionProvider>,
    );
    await userEvent.click(await screen.findByRole('tab', { name: 'Versions' }));
    expect(await screen.findByRole('heading', { name: 'Historique des versions' })).toBeVisible();
    expect(screen.getByText('Motif : correction du titre')).toBeVisible();
    expect(screen.getByText(/Cochez deux versions/)).toBeVisible();

    await userEvent.click(screen.getByRole('checkbox', { name: /version 1 de/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /version 2 de/i }));
    const table = screen.getByRole('table');
    const titleRow = within(table).getByText('Titre').closest('tr') as HTMLElement;
    expect(titleRow).toHaveClass('is-changed');
    expect(within(titleRow).getByText('Titre initial')).toBeVisible();
    expect(within(titleRow).getByText('Titre corrigé')).toBeVisible();
    expect(within(table).getByText('Langue').closest('tr')).not.toHaveClass('is-changed');
  });
});
