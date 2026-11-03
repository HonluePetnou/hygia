import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionViewModel, type AuthGateway } from '@hygia/view-models';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginScreen } from '@/components/login/LoginScreen';
import { SessionProvider } from '@/lib/session-context';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/connexion',
}));

function renderLogin(session = new SessionViewModel()) {
  render(
    <SessionProvider session={session}>
      <LoginScreen />
    </SessionProvider>,
  );
  return session;
}

async function passFirstStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Adresse e-mail'), 'aicha.nana@hd-bonassama.cm');
  await user.type(screen.getByLabelText('Mot de passe'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Se connecter' }));
}

describe('parcours de connexion', () => {
  beforeEach(() => replace.mockClear());

  it('refuse des identifiants vides', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Identifiants invalides');
  });

  it('refuse un mauvais code puis accepte le code de démonstration', async () => {
    const user = userEvent.setup();
    renderLogin();
    await passFirstStep(user);

    expect(screen.getByText(/aicha\.nana@hd-bonassama\.cm/)).toBeInTheDocument();
    await user.click(screen.getByLabelText('Chiffre 1 sur 6'));
    await user.keyboard('123456');
    await user.click(screen.getByRole('button', { name: 'Vérifier et continuer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Code incorrect ou expiré');
    expect(replace).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText('Chiffre 1 sur 6'));
    await user.keyboard('481516');
    await user.click(screen.getByRole('button', { name: 'Vérifier et continuer' }));
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('accepte le collage du code complet', async () => {
    const user = userEvent.setup();
    const session = renderLogin();
    await passFirstStep(user);
    await user.click(screen.getByLabelText('Chiffre 1 sur 6'));
    await user.paste('481516');
    await user.click(screen.getByRole('button', { name: 'Vérifier et continuer' }));
    expect(session.isAuthenticated).toBe(true);
  });

  it('première connexion : QR code d’enrôlement, puis codes de secours à acquitter', async () => {
    const user = userEvent.setup();
    const auth: AuthGateway = {
      login: async () => ({ challengeId: 'c', mfa: 'enroll' }),
      enroll: async () => ({ secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/x', qrCode: 'data:image/png;base64,AA==' }),
      verify: async () => ({
        accessToken: 'jwt',
        expiresAt: '2026-11-05T09:30:00.000Z',
        user: { id: 'u', email: 'neo@hygia.local', displayName: 'Néo', role: 'analyste' },
        backupCodes: ['aaaa111111', 'bbbb222222'],
      }),
    };
    renderLogin(new SessionViewModel({ auth }));
    await passFirstStep(user);

    expect(await screen.findByAltText(/QR code d’enrôlement|QR code d'enrôlement/)).toBeInTheDocument();
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Chiffre 1 sur 6'));
    await user.keyboard('123456');
    await user.click(screen.getByRole('button', { name: 'Vérifier et continuer' }));

    expect(await screen.findByText('aaaa111111')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: "J'ai noté mes codes" }));
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('connexion avec un code de secours', async () => {
    const user = userEvent.setup();
    const verify = vi.fn(async () => ({
      accessToken: 'jwt',
      expiresAt: '2026-11-05T09:30:00.000Z',
      user: { id: 'u', email: 'a@b.c', displayName: 'A', role: 'medecin' as const },
    }));
    const auth: AuthGateway = {
      login: async () => ({ challengeId: 'c', mfa: 'verify' }),
      enroll: async () => Promise.reject(new Error('inutile')),
      verify,
    };
    renderLogin(new SessionViewModel({ auth }));
    await passFirstStep(user);
    await user.click(screen.getByRole('button', { name: 'Utiliser un code de secours' }));
    await user.type(screen.getByLabelText('Code de secours'), 'DEMO-0001');
    await user.click(screen.getByRole('button', { name: 'Vérifier et continuer' }));
    expect(verify).toHaveBeenCalledWith('c', { backupCode: 'DEMO-0001' });
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('bascule toute l’interface en anglais', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText("Your patients' clinical memory, secure and bilingual.")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });
});
