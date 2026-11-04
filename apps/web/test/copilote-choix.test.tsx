import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FLORENCE_ID, demoDataset } from '@hygia/fhir';
import { InMemoryPatientsGateway, SessionViewModel } from '@hygia/view-models';
import { describe, expect, it, vi } from 'vitest';
import { CopilotePicker } from '@/components/copilote/CopilotePicker';
import { GatewayProvider } from '@/lib/gateway-context';
import { SessionProvider } from '@/lib/session-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/copilote',
}));

function renderPicker(session = new SessionViewModel()) {
  render(
    <SessionProvider session={session}>
      <GatewayProvider gateway={new InMemoryPatientsGateway(demoDataset, () => '2026-10-28')}>
        <CopilotePicker />
      </GatewayProvider>
    </SessionProvider>,
  );
}

describe('« Copilote IA » sans patient choisi', () => {
  it('propose les patients et ouvre le copilote du patient choisi', async () => {
    renderPicker();
    expect(screen.getByRole('heading', { name: 'Copilote IA' })).toBeInTheDocument();
    expect(screen.getByText(/Choisissez un patient/)).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: /Florence Ngo Bassa/ });
    expect(link).toHaveAttribute('href', `/copilote/${FLORENCE_ID}`);
  });

  it('filtre la liste par nom ou IPP', async () => {
    const user = userEvent.setup();
    renderPicker();
    await screen.findByRole('link', { name: /Florence Ngo Bassa/ });
    await user.type(screen.getByRole('searchbox', { name: /Rechercher un patient/ }), 'HYG-2024-00871');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(await screen.findAllByRole('link', { name: /Florence/ })).toHaveLength(1);
  });

  it("s'affiche aussi en anglais", async () => {
    renderPicker(new SessionViewModel({ locale: 'en' }));
    expect(screen.getByRole('heading', { name: 'AI Copilot' })).toBeInTheDocument();
    expect(screen.getByText(/Choose a patient/)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Florence Ngo Bassa/ })).toBeInTheDocument();
  });
});
