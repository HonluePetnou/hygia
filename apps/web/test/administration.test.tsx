import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GatewayError, InMemoryAdministrationGateway, SessionViewModel } from '@hygia/view-models';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdministrationScreen } from '@/components/administration/AdministrationScreen';
import { AppShell } from '@/components/shell/AppShell';
import { Sidebar } from '@/components/shell/Sidebar';
import { GatewayProvider } from '@/lib/gateway-context';
import { SessionProvider } from '@/lib/session-context';

const navigation = vi.hoisted(() => ({ pathname: '/administration', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => navigation.pathname,
}));

beforeEach(() => {
  navigation.pathname = '/administration';
  navigation.replace.mockClear();
});

/** Session d'administrateur déjà ouverte (connexion hors ligne : code de démonstration). */
async function adminSession() {
  const session = new SessionViewModel({
    role: 'admin',
    userId: '00000000-0000-4000-8000-020000000007',
    displayName: 'Lionel Tchakounte',
  });
  await session.submitCredentials('admin@hygia.local', 'Hygia-demo-2026');
  await session.submitCode('481516');
  return session;
}

async function setup(gateway = new InMemoryAdministrationGateway()) {
  const session = await adminSession();
  return render(
    <SessionProvider session={session}>
      <GatewayProvider administration={gateway}>
        <Sidebar />
        <AdministrationScreen />
      </GatewayProvider>
    </SessionProvider>,
  );
}

describe('écran Administration', () => {
  it('affiche utilisateurs, équipes de soins et politique de sécurité', async () => {
    await setup();
    expect(await screen.findByRole('heading', { level: 1, name: 'Comptes et rôles' })).toBeVisible();
    const nana = screen.getByText('Dr Aïcha Nana', { selector: 'strong' }).closest('tr')!;
    expect(nana).toHaveTextContent('aicha.nana@hd-bonassama.cm');
    expect(within(nana).getByLabelText('Rôle de Dr Aïcha Nana')).toHaveValue('medecin');
    expect(nana).toHaveTextContent('Cardiologie');
    expect(nana).toHaveTextContent('Activée');
    expect(nana).toHaveTextContent('03/11/2026 08:12');
    expect(screen.getByText('Dr Paul Kamga', { selector: 'strong' }).closest('tr')).toHaveTextContent('Non configurée');
    expect(screen.getByRole('heading', { name: 'Équipes de soins' })).toBeVisible();
    expect(screen.getByText('Session : 30 minutes')).toBeVisible();
    expect(screen.getByText('Bris de glace : 4 heures')).toBeVisible();
    expect(screen.getByText('Mots de passe : 12 caractères minimum')).toBeVisible();
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Comptes et rôles', 'Supervision']);
  });

  it('invitation : formulaire, compte ajouté, mot de passe provisoire affiché, action auditée', async () => {
    const user = userEvent.setup();
    const gateway = new InMemoryAdministrationGateway();
    await setup(gateway);
    await user.click(await screen.findByRole('button', { name: 'Inviter un utilisateur' }));
    const dialog = screen.getByRole('dialog', { name: 'Inviter un utilisateur' });
    await user.type(within(dialog).getByLabelText('Nom complet'), 'Samuel Tchoua');
    await user.type(within(dialog).getByLabelText('Adresse e-mail'), 'samuel.tchoua@hd-bonassama.cm');
    await user.selectOptions(within(dialog).getByLabelText('Rôle'), 'infirmier');
    await user.selectOptions(within(dialog).getByLabelText('Équipe de soins (facultatif)'), 'Cardiologie');
    await user.click(within(dialog).getByRole('button', { name: 'Envoyer l’invitation' }));
    const row = (await screen.findByText('Samuel Tchoua', { selector: 'strong' })).closest('tr')!;
    expect(row).toHaveTextContent('Infirmier');
    expect(row).toHaveTextContent('Cardiologie');
    expect(row).toHaveTextContent('Non configurée');
    expect(screen.getByRole('status')).toHaveTextContent('Mot de passe provisoire (affiché une seule fois) : Tmp-demo-4821');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(gateway.audited.filter((line) => line.startsWith('invitation:'))).toHaveLength(1);
  });

  it('invitation refusée (adresse déjà utilisée) : message dans la fenêtre', async () => {
    const user = userEvent.setup();
    await setup();
    await user.click(await screen.findByRole('button', { name: 'Inviter un utilisateur' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nom complet'), 'Doublon');
    await user.type(within(dialog).getByLabelText('Adresse e-mail'), 'rose.mballa@hd-bonassama.cm');
    await user.click(within(dialog).getByRole('button', { name: 'Envoyer l’invitation' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('déjà utilisée');
  });

  it('changement de rôle, 2FA réinitialisée, désactivation : chaque action est auditée', async () => {
    const user = userEvent.setup();
    const gateway = new InMemoryAdministrationGateway();
    await setup(gateway);
    await user.selectOptions(await screen.findByLabelText('Rôle de Rose Mballa'), 'medecin');
    await waitFor(() => expect(screen.getByLabelText('Rôle de Rose Mballa')).toHaveValue('medecin'));
    await user.click(screen.getByRole('button', { name: 'Réinitialiser la 2FA de Rose Mballa' }));
    await waitFor(() => expect(screen.getByText('Rose Mballa', { selector: 'strong' }).closest('tr')).toHaveTextContent('Non configurée'));
    await user.click(screen.getByRole('button', { name: 'Désactiver Rose Mballa' }));
    const row = await waitFor(() => {
      const r = screen.getByText('Rose Mballa', { selector: 'strong' }).closest('tr')!;
      expect(r).toHaveTextContent('Désactivé');
      return r;
    });
    expect(within(row).getByRole('button', { name: 'Réactiver Rose Mballa' })).toBeVisible();
    expect(gateway.audited.map((line) => line.split(':')[0])).toEqual(['role', '2fa', 'desactivation']);
  });

  it('on ne peut ni changer son propre rôle ni se désactiver', async () => {
    await setup();
    const own = (await screen.findByText('Lionel Tchakounte', { selector: 'strong' })).closest('tr')!;
    expect(within(own).getByLabelText('Rôle de Lionel Tchakounte')).toBeDisabled();
    expect(within(own).getByRole('button', { name: 'Désactiver Lionel Tchakounte' })).toBeDisabled();
  });

  it('équipes : création, ajout de membre, patient rattaché', async () => {
    const user = userEvent.setup();
    const gateway = new InMemoryAdministrationGateway();
    await setup(gateway);
    await user.type(await screen.findByLabelText('Nom de la nouvelle équipe'), 'Urgences');
    await user.click(screen.getByRole('button', { name: 'Créer l’équipe' }));
    const team = (await screen.findByRole('heading', { name: 'Urgences' })).closest('li')!;
    expect(team).toHaveTextContent('Aucun membre');
    await user.selectOptions(within(team).getByLabelText('Ajouter un membre à Urgences'), 'Dr Paul Kamga');
    await waitFor(() => expect(within(team).getByText('Dr Paul Kamga')).toBeVisible());
    expect(screen.getByText('Dr Paul Kamga', { selector: 'strong' }).closest('tr')).toHaveTextContent('Urgences');
    await user.type(within(team).getByLabelText('Identifiant du patient à rattacher à Urgences'), 'abcd1234-0000');
    await user.click(within(team).getByRole('button', { name: 'Rattacher' }));
    await waitFor(() => expect(within(team).getByText('abcd1234')).toBeVisible());
    expect(team).toHaveTextContent('Patients rattachés (1)');
    await user.click(within(team).getByRole('button', { name: 'Retirer Dr Paul Kamga de Urgences' }));
    await waitFor(() => expect(team).toHaveTextContent('Aucun membre'));
  });

  it('refus du service (403) : message réservé à l’administrateur', async () => {
    const denied = new InMemoryAdministrationGateway();
    denied.load = () => Promise.reject(new GatewayError(403, 'GET /comptes'));
    await setup(denied);
    expect(await screen.findByRole('alert')).toHaveTextContent('réservée à l’administrateur système');
  });
});

describe('administrateur système : aucun accès aux dossiers', () => {
  async function shell(pathname: string) {
    const session = await adminSession();
    navigation.pathname = pathname;
    const child = vi.fn(() => <p>contenu du dossier</p>);
    const Child = () => child();
    render(
      <SessionProvider session={session}>
        <GatewayProvider administration={new InMemoryAdministrationGateway()}>
          <AppShell>
            <Child />
          </AppShell>
        </GatewayProvider>
      </SessionProvider>,
    );
    return child;
  }

  it('un lien direct vers un dossier patient affiche « Accès refusé » sans charger le dossier', async () => {
    const child = await shell('/patients/00000000-0000-4000-8000-030000000001');
    expect(screen.getByRole('alert')).toHaveTextContent('Accès refusé');
    expect(screen.getByRole('alert')).toHaveTextContent('aucun accès aux données de santé');
    expect(screen.queryByText('contenu du dossier')).not.toBeInTheDocument();
    expect(child).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /urgence/i })).not.toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Comptes et rôles', 'Supervision']);
  });

  it.each(['/patients', '/copilote/x', '/alertes', '/import', '/audit'])('%s est refusé', async (path) => {
    await shell(path);
    expect(screen.getByRole('alert')).toHaveTextContent('Accès refusé');
  });

  it('les écrans /administration et /supervision restent accessibles', async () => {
    await shell('/administration');
    expect(screen.getByText('contenu du dossier')).toBeVisible();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('l’accueil ramène vers /administration', async () => {
    await shell('/');
    expect(navigation.replace).toHaveBeenCalledWith('/administration');
  });
});
