import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FLORENCE_ID, demoDataset } from '@hygia/fhir';
import {
  InMemoryPatientsGateway,
  InMemoryScribeGateway,
  SessionViewModel,
  type AudioRecorder,
} from '@hygia/view-models';
import { describe, expect, it, vi } from 'vitest';
import { PatientScreen } from '@/components/patient/PatientScreen';
import { GatewayProvider } from '@/lib/gateway-context';
import { SessionProvider } from '@/lib/session-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/',
}));

const recorder: AudioRecorder = {
  start: async () => undefined,
  stop: async () => ({ base64: 'YXVkaW8=', durationSeconds: 12 }),
  level: () => 0.4,
};

function renderRecord(scribe: InMemoryScribeGateway, role: 'medecin' | 'infirmier' = 'medecin') {
  const patients = new InMemoryPatientsGateway(demoDataset, () => '2026-10-28');
  render(
    <SessionProvider session={new SessionViewModel({ role })}>
      <GatewayProvider gateway={patients} scribe={scribe}>
        <PatientScreen patientId={FLORENCE_ID} createRecorder={() => recorder} />
      </GatewayProvider>
    </SessionProvider>,
  );
}

describe('« Dicter » dans le dossier', () => {
  it('enregistre, présente le brouillon « À valider » puis valide', async () => {
    const user = userEvent.setup();
    renderRecord(new InMemoryScribeGateway());
    await user.click(await screen.findByRole('button', { name: 'Dicter' }));
    await user.click(screen.getByRole('button', { name: 'Démarrer l’enregistrement' }));
    expect(await screen.findByText(/Enregistrement ·/)).toBeVisible();
    expect(screen.getByText(/Consentement du patient recueilli/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Arrêter l’enregistrement' }));

    const draft = await screen.findByRole('region', { name: 'Brouillon structuré (FHIR)' });
    expect(draft).toHaveTextContent('À valider');
    expect(draft).toHaveTextContent('I10 · Hypertension essentielle');
    expect(draft).toHaveTextContent('Amlodipine 10 mg 1×/j');
    expect(screen.getByText(/Rien n’est ajouté au dossier sans la validation/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Corriger' }));
    await user.clear(screen.getByRole('textbox', { name: 'Motif' }));
    await user.type(screen.getByRole('textbox', { name: 'Motif' }), 'Contrôle');
    await user.click(screen.getByRole('button', { name: 'Valider et enregistrer' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Audio supprimé'));
  });

  it('le rejet n’enregistre rien', async () => {
    const user = userEvent.setup();
    renderRecord(new InMemoryScribeGateway());
    await user.click(await screen.findByRole('button', { name: 'Dicter' }));
    await user.click(screen.getByRole('button', { name: 'Démarrer l’enregistrement' }));
    await user.click(await screen.findByRole('button', { name: 'Arrêter l’enregistrement' }));
    await user.click(await screen.findByRole('button', { name: 'Rejeter' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Rien n’a été enregistré');
  });

  it('explique l’absence de consentement du patient', async () => {
    const user = userEvent.setup();
    const scribe = new InMemoryScribeGateway();
    scribe.refused.add(FLORENCE_ID);
    renderRecord(scribe);
    await user.click(await screen.findByRole('button', { name: 'Dicter' }));
    await user.click(screen.getByRole('button', { name: 'Démarrer l’enregistrement' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('n’a pas consenti');
  });
});
