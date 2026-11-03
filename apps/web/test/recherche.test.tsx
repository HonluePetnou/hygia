import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { demoDataset } from '@hygia/fhir';
import { InMemoryPatientsGateway, SessionViewModel } from '@hygia/view-models';
import { describe, expect, it, vi } from 'vitest';
import { PatientsScreen } from '@/components/patients/PatientsScreen';
import { Topbar } from '@/components/shell/Topbar';
import { GatewayProvider } from '@/lib/gateway-context';
import { SessionProvider } from '@/lib/session-context';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push }),
  usePathname: () => '/patients',
}));

function setup(ui: React.ReactNode) {
  const session = new SessionViewModel();
  const gateway = new InMemoryPatientsGateway(demoDataset, () => '2026-11-03');
  render(
    <SessionProvider session={session}>
      <GatewayProvider gateway={gateway}>{ui}</GatewayProvider>
    </SessionProvider>,
  );
  return session;
}

const chips = () =>
  within(screen.getByRole('list', { name: 'Compris comme :' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe('recherche en langage naturel', () => {
  it('affiche les 4 puces de la requête de la maquette', async () => {
    setup(<PatientsScreen initialQuery="" />);
    await screen.findByRole('table');
    expect(screen.getByText('Langage naturel')).toBeVisible();
    await userEvent.type(
      screen.getByRole('searchbox', { name: /langage naturel/ }),
      'patients diabétiques de plus de 60 ans vus depuis janvier avec une HbA1c > 8 %{Enter}',
    );
    expect(await screen.findByText('Aucun patient ne correspond')).toBeVisible();
    expect(chips()).toEqual([
      'HbA1c > 8 %',
      'Dernière visite ≥ 1 janv. 2026',
      'Âge > 60 ans',
      'Diagnostic : E11 · Diabète de type 2',
    ]);
  });

  it('comprend la requête équivalente en anglais', async () => {
    setup(<PatientsScreen initialQuery="" />);
    await screen.findByRole('table');
    await userEvent.type(
      screen.getByRole('searchbox'),
      'diabetic patients older than 60 seen since January with HbA1c above 8%{Enter}',
    );
    await screen.findByText('Aucun patient ne correspond');
    expect(chips()).toHaveLength(4);
    expect(chips()).toContain('Diagnostic : E11 · Diabète de type 2');
  });

  it('supprimer une puce relance la recherche', async () => {
    setup(<PatientsScreen initialQuery="insuffisance cardiaque de moins de 10 ans" />);
    expect(await screen.findByText('Aucun patient ne correspond')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Retirer le filtre : Âge < 10 ans' }));
    expect(await screen.findByRole('link', { name: 'Florence Ngo Bassa' })).toBeVisible();
    expect(chips()).toEqual(['Diagnostic : I50 · Insuffisance cardiaque']);
    const row = screen.getByRole('link', { name: 'Florence Ngo Bassa' }).closest('tr') as HTMLElement;
    expect(within(row).getByText('I48 Fibrillation auriculaire')).toBeVisible();
    expect(screen.getByText(/1 patient correspond/)).toBeVisible();
  });

  it('la barre supérieure ouvre la page des patients avec la requête', async () => {
    setup(<Topbar />);
    await userEvent.type(screen.getByRole('searchbox'), 'diabète{Enter}');
    expect(push).toHaveBeenCalledWith('/patients?q=diab%C3%A8te');
  });
});
