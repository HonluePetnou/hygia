import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionViewModel } from '@hygia/view-models';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginScreen } from '@/components/login/LoginScreen';
import { AppShell } from '@/components/shell/AppShell';
import { GatewayProvider } from '@/lib/gateway-context';
import { SessionProvider } from '@/lib/session-context';

const navigation = vi.hoisted(() => ({ pathname: '/', replace: vi.fn() }));
const replace = navigation.replace;
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace, push: () => undefined }),
  usePathname: () => navigation.pathname,
}));

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Adresse e-mail'), 'paul.kamga@cma-bepanda.cm');
  await user.type(screen.getByLabelText('Mot de passe'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Se connecter' }));
  await user.click(screen.getByLabelText('Chiffre 1 sur 6'));
  await user.keyboard('481516');
  await user.click(screen.getByRole('button', { name: 'Vérifier et continuer' }));
}

function renderLogin() {
  render(
    <SessionProvider session={new SessionViewModel()}>
      <LoginScreen />
    </SessionProvider>,
  );
}

describe('retour à la page demandée après connexion', () => {
  beforeEach(() => replace.mockClear());
  afterEach(() => window.history.replaceState({}, '', '/'));

  it('un lien direct sans session renvoie à la connexion en gardant la page demandée', () => {
    navigation.pathname = '/patients/00000000-0000-4000-8000-030000000001';
    render(
      <SessionProvider session={new SessionViewModel()}>
        <AppShell>contenu</AppShell>
      </SessionProvider>,
    );
    expect(replace).toHaveBeenCalledWith(
      '/connexion?suite=%2Fpatients%2F00000000-0000-4000-8000-030000000001',
    );
  });

  it('une déconnexion renvoie à la connexion sans garder la page du compte précédent', async () => {
    navigation.pathname = '/patients/00000000-0000-4000-8000-030000000001';
    const session = new SessionViewModel();
    await session.submitCredentials('aicha.nana@hd-bonassama.cm', 'Hygia-demo-2026');
    await session.submitCode('481516');
    render(
      <SessionProvider session={session}>
        <GatewayProvider>
          <AppShell>contenu</AppShell>
        </GatewayProvider>
      </SessionProvider>,
    );
    replace.mockClear();
    await act(async () => session.signOut());
    expect(replace).toHaveBeenCalledWith('/connexion');
    expect(replace).not.toHaveBeenCalledWith(expect.stringContaining('suite='));
  });

  it("l'accueil sans session renvoie à la connexion sans paramètre", () => {
    navigation.pathname = '/';
    render(
      <SessionProvider session={new SessionViewModel()}>
        <AppShell>contenu</AppShell>
      </SessionProvider>,
    );
    expect(replace).toHaveBeenCalledWith('/connexion');
  });

  it('après connexion, ouvre la page demandée (dossier hors équipe → bris de glace)', async () => {
    window.history.replaceState({}, '', '/connexion?suite=%2Fpatients%2Fabc');
    const user = userEvent.setup();
    renderLogin();
    await signIn(user);
    expect(replace).toHaveBeenCalledWith('/patients/abc');
  });

  it('ignore une page demandée hors du site', async () => {
    window.history.replaceState({}, '', '/connexion?suite=%2F%2Fexemple.com%2Fpiege');
    const user = userEvent.setup();
    renderLogin();
    await signIn(user);
    expect(replace).toHaveBeenCalledWith('/');
  });
});
