import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FLORENCE_ID, demoDataset } from '@hygia/fhir';
import { InMemoryPatientsGateway, SessionViewModel } from '@hygia/view-models';
import { describe, expect, it, vi } from 'vitest';
import { DashboardScreen } from '@/components/dashboard/DashboardScreen';
import { PatientScreen } from '@/components/patient/PatientScreen';
import { PatientsScreen } from '@/components/patients/PatientsScreen';
import { GatewayProvider } from '@/lib/gateway-context';
import { SessionProvider } from '@/lib/session-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/',
}));

const TODAY = () => '2026-10-28';

function renderWith(ui: React.ReactNode, identity?: { userId: string }) {
  const session = new SessionViewModel();
  const gateway = new InMemoryPatientsGateway(
    demoDataset,
    TODAY,
    identity ? () => ({ userId: identity.userId, role: 'medecin' }) : () => session.identity,
  );
  render(
    <SessionProvider session={session}>
      <GatewayProvider gateway={gateway}>{ui}</GatewayProvider>
    </SessionProvider>,
  );
  return { session, gateway };
}

describe('tableau de bord', () => {
  it('affiche le titre, les quatre indicateurs et les cartes avec les données en mémoire', async () => {
    renderWith(<DashboardScreen />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Bonjour, Dr Nana' })).toBeVisible();

    for (const label of [
      'Patients du jour',
      'Alertes IA ouvertes',
      'Documents en traitement',
      'Résultats à valider',
    ]) {
      expect(screen.getByText(label)).toBeVisible();
    }
    expect(within(screen.getByTestId('indicator-pendingAlerts')).getByText('4')).toBeVisible();

    const table = screen.getByRole('table');
    expect(within(table).getByText('Florence Ngo Bassa')).toBeVisible();
    expect(within(table).getByText('09:00')).toBeVisible();
    expect(within(table).getByRole('link', { name: /Résumé IA/ })).toHaveAttribute(
      'href',
      `/patients/${FLORENCE_ID}`,
    );

    expect(screen.getByRole('heading', { name: 'Alertes IA' })).toBeVisible();
    expect(screen.getAllByRole('progressbar')).toHaveLength(3);
    expect(screen.getByRole('heading', { name: 'Activité de la semaine' })).toBeVisible();
  });
});

describe('liste des patients', () => {
  it('filtre par nom ou IPP', async () => {
    const user = userEvent.setup();
    renderWith(<PatientsScreen />);
    expect(await screen.findAllByRole('row')).toHaveLength(10);
    await user.type(
      screen.getByLabelText('Rechercher par nom, IPP ou question en langage naturel'),
      'HYG-2024-00871{Enter}',
    );
    expect(await screen.findAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Florence Ngo Bassa' })).toBeVisible();
  });
});

describe('dossier patient', () => {
  it('affiche l’en-tête, le résumé IA sourcé et filtre la chronologie', async () => {
    const user = userEvent.setup();
    renderWith(<PatientScreen patientId={FLORENCE_ID} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Florence Ngo Bassa' })).toBeVisible();
    expect(screen.getByText('Allergie : Pénicilline')).toBeVisible();
    expect(screen.getByText('Sous anticoagulant')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Valider le résumé' })).toBeVisible();
    expect(screen.getByText(/Aide à la décision/)).toBeVisible();

    const timeline = screen.getByRole('region', { name: 'Chronologie du dossier' });
    const all = within(timeline).getAllByRole('listitem').length;
    expect(all).toBeGreaterThan(8);

    await user.click(within(timeline).getByRole('button', { name: 'Consultations' }));
    expect(within(timeline).getAllByRole('listitem')).toHaveLength(1);
    await user.click(within(timeline).getByRole('button', { name: 'Tout' }));
    expect(within(timeline).getAllByRole('listitem')).toHaveLength(all);

    await user.click(screen.getByRole('button', { name: 'Valider le résumé' }));
    expect(screen.getByRole('status')).toHaveTextContent('Résumé validé');
  });

  it('refuse l’accès hors équipe et ouvre la fenêtre de bris de glace', async () => {
    const user = userEvent.setup();
    const { gateway } = renderWith(<PatientScreen patientId={FLORENCE_ID} />, {
      userId: 'inconnu',
    });
    const spy = vi.spyOn(gateway, 'openBreakGlass');

    expect(await screen.findByRole('heading', { name: 'Accès refusé' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Accès d’urgence' }));

    const dialog = screen.getByRole('dialog', { name: 'Accès d’urgence (bris de glace)' });
    expect(within(dialog).getByText(/Accès valable 4 heures/)).toBeVisible();
    expect(within(dialog).getByText(/La DPO est alertée/)).toBeVisible();
    expect(within(dialog).getByText(/Le patient verra cet accès/)).toBeVisible();

    const submit = within(dialog).getByRole('button', { name: 'Ouvrir le dossier en urgence' });
    expect(submit).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Précisions (obligatoire)'), 'Admise aux urgences');
    await user.click(submit);

    expect(spy).toHaveBeenCalledWith(FLORENCE_ID, {
      motif: 'Urgence vitale — patient inconscient ou non communicant',
      precisions: 'Admise aux urgences',
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Florence Ngo Bassa' })).toBeVisible();
  });
});
