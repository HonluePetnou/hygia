import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FLORENCE_ID } from '@hygia/fhir';
import { InMemoryAuditGateway, InMemoryPortalGateway, SessionViewModel } from '@hygia/view-models';
import { describe, expect, it, vi } from 'vitest';
import { AuditScreen } from '@/components/audit/AuditScreen';
import { PortalScreen } from '@/components/portal/PortalScreen';
import { GatewayProvider } from '@/lib/gateway-context';
import { SessionProvider } from '@/lib/session-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/portail',
}));

function setup(portal = new InMemoryPortalGateway(), audit = new InMemoryAuditGateway()) {
  const session = new SessionViewModel({
    userId: FLORENCE_ID,
    displayName: 'Florence Ngo Bassa',
    role: 'patient',
  });
  render(
    <SessionProvider session={session}>
      <GatewayProvider portal={portal} audit={audit}>
        <PortalScreen />
      </GatewayProvider>
    </SessionProvider>,
  );
  return { session, audit };
}

describe('portail patient (maquette 13)', () => {
  it('permet de se déconnecter depuis le portail', async () => {
    const user = userEvent.setup();
    const { session } = setup();
    await session.submitCredentials('florence.ngo@patient.hygia.local', 'Hygia-demo-2026');
    await session.submitCode('481516');
    expect(session.isAuthenticated).toBe(true);
    await user.click(await screen.findByRole('button', { name: 'Se déconnecter' }));
    expect(session.isAuthenticated).toBe(false);
  });

  it('affiche le bandeau, le prochain rendez-vous et le journal avec le bris de glace en orange', async () => {
    const user = userEvent.setup();
    setup();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bonjour Florence' }),
    ).toBeVisible();
    expect(screen.getByText('Mardi 3 novembre · 10:00')).toBeVisible();
    expect(screen.getByText('Dr Aïcha Nana · Cardiologie · Bonassama')).toBeVisible();
    const nav = screen.getByRole('navigation', { name: 'Navigation du portail patient' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual([
      'Mon dossier',
      'Rendez-vous',
      'Qui a vu mon dossier ?',
      'Consentements',
      'Mes droits',
    ]);
    const log = screen.getByRole('list', { name: 'Accès à mon dossier' });
    expect(within(log).getAllByRole('listitem')).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: 'Tout afficher' }));
    const rows = within(log).getAllByRole('listitem');
    expect(rows).toHaveLength(7);
    const breakGlass = rows.find((row) => row.classList.contains('portal-log-breakGlass'));
    expect(breakGlass).toHaveTextContent(
      'Accès d’urgence — motif : Urgence vitale — patient inconscient',
    );
    expect(within(breakGlass as HTMLElement).getByText('Bris de glace')).toBeVisible();
  });

  it('bascule les consentements ; les soins sont requis et sans interrupteur', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole('heading', { name: 'Mes consentements' });
    expect(screen.getByText('Requis')).toBeVisible();
    expect(screen.getAllByRole('switch')).toHaveLength(4);
    const ia = screen.getByRole('switch', { name: 'Intelligence artificielle' });
    const audio = screen.getByRole('switch', { name: 'Enregistrement des consultations' });
    expect(ia).toBeChecked();
    expect(audio).not.toBeChecked();
    await user.click(ia);
    expect(await screen.findByRole('status')).toHaveTextContent('Votre choix est enregistré.');
    expect(screen.getByRole('switch', { name: 'Intelligence artificielle' })).not.toBeChecked();
    await user.click(screen.getByRole('switch', { name: 'Intelligence artificielle' }));
    expect(screen.getByRole('switch', { name: 'Intelligence artificielle' })).toBeChecked();
  });

  it('transmet signalement et rectification à la DPO, qui les voit dans /audit', async () => {
    const user = userEvent.setup();
    const audit = new InMemoryAuditGateway();
    setup(undefined, audit);
    await screen.findByRole('heading', { name: 'Mes droits' });

    await user.click(screen.getByRole('button', { name: 'Signaler' }));
    await user.selectOptions(
      screen.getByLabelText('Accès à signaler'),
      screen.getAllByRole('option')[1] as HTMLElement,
    );
    await user.click(screen.getByRole('button', { name: 'Envoyer à la DPO' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Signalement transmis');

    await user.click(screen.getByRole('button', { name: 'Demander une rectification' }));
    await user.type(screen.getByLabelText('Précisez votre demande'), 'Date de naissance erronée');
    await user.click(screen.getByRole('button', { name: 'Envoyer à la DPO' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Demande de rectification transmise',
    );

    const dpo = render(
      <SessionProvider session={new SessionViewModel({ role: 'auditeur' })}>
        <GatewayProvider audit={audit}>
          <AuditScreen />
        </GatewayProvider>
      </SessionProvider>,
    );
    const panel = await within(dpo.container).findByRole('region', {
      name: 'Demandes des patients',
    });
    const items = within(panel).getAllByTestId('rights-request');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Rectification');
    expect(items[0]).toHaveTextContent('Date de naissance erronée');
    expect(items[1]).toHaveTextContent('Accès signalé');
  });

  it('télécharge le dossier en PDF (droit d’accès)', async () => {
    const user = userEvent.setup();
    const portal = new InMemoryPortalGateway();
    const download = vi.spyOn(portal, 'downloadDossier');
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    setup(portal);
    await user.click(await screen.findByRole('button', { name: 'Télécharger mon dossier (PDF)' }));
    expect(download).toHaveBeenCalledWith(FLORENCE_ID, 'fr');
  });

  it('s’affiche en anglais selon la langue enregistrée du patient', async () => {
    const { session } = setup(new InMemoryPortalGateway('en'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Hello Florence' })).toBeVisible();
    expect(session.locale).toBe('en');
    expect(screen.getByRole('heading', { name: 'Who viewed my record?' })).toBeVisible();
    expect(screen.getByText('Next appointment')).toBeVisible();
    expect(screen.getByRole('switch', { name: 'Artificial intelligence' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Request deletion' })).toBeVisible();
  });
});
