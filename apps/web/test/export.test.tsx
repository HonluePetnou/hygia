import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { demoDataset } from '@hygia/fhir';
import {
  GatewayError,
  InMemoryEpidemiologyGateway,
  InMemoryPatientsGateway,
  SessionViewModel,
} from '@hygia/view-models';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EpidemiologyScreen } from '@/components/epidemiologie/EpidemiologyScreen';
import { PatientsScreen } from '@/components/patients/PatientsScreen';
import { GatewayProvider } from '@/lib/gateway-context';
import { SessionProvider } from '@/lib/session-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/patients',
}));

const created: Blob[] = [];
const click = vi.fn();

function stubDownloads(): void {
  URL.createObjectURL = (blob: Blob | MediaSource): string => {
    created.push(blob as Blob);
    return 'blob:test';
  };
  URL.revokeObjectURL = () => undefined;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click);
}

afterEach(() => {
  created.length = 0;
  click.mockReset();
  vi.restoreAllMocks();
});

describe('exports (RF17)', () => {
  it('« Exporter CSV » télécharge la liste des patients avec ses en-têtes', async () => {
    stubDownloads();
    const gateway = new InMemoryPatientsGateway(demoDataset, () => '2026-11-03');
    render(
      <SessionProvider session={new SessionViewModel()}>
        <GatewayProvider gateway={gateway}>
          <PatientsScreen initialQuery="" />
        </GatewayProvider>
      </SessionProvider>,
    );
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Exporter CSV' }));
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    const text = await created[0]!.text();
    expect(text.split('\r\n')[0]).toBe('IPP,Nom,Prénom,Date de naissance');
    expect(text).toContain('HYG-2024-00871');
  });

  it('affiche une erreur si l’export est refusé', async () => {
    stubDownloads();
    const gateway = new InMemoryPatientsGateway(demoDataset, () => '2026-11-03');
    vi.spyOn(gateway, 'exportSearch').mockRejectedValue(new GatewayError(403, 'refusé'));
    render(
      <SessionProvider session={new SessionViewModel()}>
        <GatewayProvider gateway={gateway}>
          <PatientsScreen initialQuery="" />
        </GatewayProvider>
      </SessionProvider>,
    );
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Exporter CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('L’export a échoué');
    expect(click).not.toHaveBeenCalled();
  });

  it('« Exporter le rapport » télécharge le PDF épidémiologique', async () => {
    stubDownloads();
    render(
      <SessionProvider session={new SessionViewModel()}>
        <GatewayProvider gateway={new InMemoryPatientsGateway(demoDataset, () => '2026-11-03')} epidemiology={new InMemoryEpidemiologyGateway()}>
          <EpidemiologyScreen />
        </GatewayProvider>
      </SessionProvider>,
    );
    const button = await screen.findByRole('button', { name: 'Exporter le rapport' });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(created[0]!.type).toBe('application/pdf');
  });
});
