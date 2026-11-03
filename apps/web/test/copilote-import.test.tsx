import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FLORENCE_ID, demoDataset } from '@hygia/fhir';
import {
  InMemoryCopiloteGateway,
  InMemoryPatientsGateway,
  SessionViewModel,
  type IngestionGateway,
} from '@hygia/view-models';
import { describe, expect, it, vi } from 'vitest';
import { CopiloteScreen } from '@/components/copilote/CopiloteScreen';
import { ImportScreen } from '@/components/import/ImportScreen';
import { GatewayProvider } from '@/lib/gateway-context';
import { ApiIngestionGateway } from '@/lib/ingestion-api';
import { SessionProvider } from '@/lib/session-context';
import { runIngestion } from '@/server/run-ingestion';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/',
}));

const ORDONNANCE = 'ordonnance-florence.png';

/** Ingestion de test : appelle la même logique que la route `/api/ingestion`, sans réseau. */
function routeBackedFetch(): typeof fetch {
  return async (_input, init) => {
    const form = init?.body as FormData;
    const file = form.get('file') as File;
    const patientId = form.get('patientId');
    const result = await runIngestion(
      file.name,
      new Uint8Array(await file.arrayBuffer()),
      typeof patientId === 'string' && patientId !== '' ? patientId : undefined,
    );
    return new Response(JSON.stringify(result), { status: 200 });
  };
}

function renderWith(ui: React.ReactNode, ingestion?: IngestionGateway) {
  const session = new SessionViewModel();
  const patients = new InMemoryPatientsGateway(demoDataset, () => '2026-10-28');
  render(
    <SessionProvider session={session}>
      <GatewayProvider
        gateway={patients}
        copilote={new InMemoryCopiloteGateway(demoDataset)}
        {...(ingestion ? { ingestion } : {})}
      >
        {ui}
      </GatewayProvider>
    </SessionProvider>,
  );
}

describe('copilote', () => {
  it('envoie une question, affiche la réponse sourcée et ouvre la source citée', async () => {
    const user = userEvent.setup();
    renderWith(<CopiloteScreen patientId={FLORENCE_ID} />);

    expect(
      await screen.findByText('Recherche limitée au dossier de Florence Ngo Bassa'),
    ).toBeVisible();
    expect(screen.getByText(/ne remplace pas l’avis médical/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Évolution de l’INR' })).toBeVisible();

    await user.type(screen.getByLabelText('Posez une question sur le dossier'), 'Quel est le dernier INR ?');
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));

    const log = screen.getByRole('log');
    expect(within(log).getByText('Quel est le dernier INR ?')).toBeVisible();
    const sources = await within(log).findByRole('list', { name: 'Sources' });
    const chips = within(sources).getAllByRole('button');
    expect(chips.length).toBeGreaterThan(0);

    await user.click(within(log).getAllByRole('button', { name: 'Ouvrir la source 1' })[0] as HTMLElement);
    const panel = screen.getByRole('complementary', { name: 'Source citée' });
    expect(within(panel).getByText('Passage cité')).toBeVisible();
    expect(panel.querySelector('mark')).not.toBeNull();

    await user.click(within(panel).getByRole('button', { name: 'Fermer la source' }));
    expect(screen.queryByRole('complementary', { name: 'Source citée' })).toBeNull();
  });

  it('répond en anglais à une question en anglais avec le badge « Answered in English »', async () => {
    const user = userEvent.setup();
    renderWith(<CopiloteScreen patientId={FLORENCE_ID} />);
    await user.type(
      screen.getByLabelText('Posez une question sur le dossier'),
      'What did the last echocardiography show?',
    );
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Answered in English')).toBeVisible();
    expect(screen.getByText(/According to the record/)).toBeVisible();
  });
});

describe('import de document', () => {
  it('importe l’ordonnance fictive : 5 étapes terminées, branches et entités à valider', async () => {
    const user = userEvent.setup();
    renderWith(<ImportScreen />, new ApiIngestionGateway('/api/ingestion', routeBackedFetch()));

    expect(screen.getByText('Upload web')).toBeVisible();
    expect(screen.getByText('Application mobile')).toBeVisible();
    expect(screen.getByText('API FHIR')).toBeVisible();
    expect(screen.getByText('WhatsApp')).toBeVisible();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);

    const patient = await screen.findByRole('combobox', { name: /Rattacher au patient/ });
    await waitFor(() => expect(within(patient).getAllByRole('option').length).toBeGreaterThan(1));
    await user.selectOptions(patient, FLORENCE_ID);

    const content = new File(['fictif'], ORDONNANCE, { type: 'image/png' });
    await user.upload(screen.getByLabelText('Parcourir', { selector: 'input' }), content);

    const chain = screen.getByRole('region', { name: 'Chaîne d’analyse' });
    await waitFor(() => {
      const steps = within(chain).getAllByRole('listitem');
      expect(steps).toHaveLength(5);
      steps.forEach((step) => expect(step).toHaveTextContent('Terminé'));
    });
    for (const label of ['Réception', 'OCR', 'Normalisation', 'Extraction IA', 'Détection des identifiants']) {
      expect(within(chain).getByText(new RegExp(`· ${label}$`))).toBeVisible();
    }
    expect(within(chain).getByText(/6a · Branche clinique/)).toBeVisible();
    expect(within(chain).getByText(/6b · Branche analytique/)).toBeVisible();

    const table = screen.getByRole('table');
    expect(within(table).getByText('Ibuprofène')).toBeVisible();
    expect(within(table).getByText('ATC M01AE01')).toBeVisible();
    expect(within(table).getByText('Lombalgie basse')).toBeVisible();
    expect(within(table).getByText('CIM-10 M54.5')).toBeVisible();

    expect(screen.getByRole('status')).toHaveTextContent('en attente de validation');
    await user.click(screen.getByRole('button', { name: 'Tout valider' }));
    expect(screen.getByRole('status')).toHaveTextContent('Toutes les entités ont été examinées.');
    expect(screen.getByRole('button', { name: 'Tout valider' })).toBeDisabled();
  });

  it('affiche l’étape en erreur quand le document est inconnu', async () => {
    const user = userEvent.setup();
    renderWith(<ImportScreen />, new ApiIngestionGateway('/api/ingestion', routeBackedFetch()));
    await user.upload(
      screen.getByLabelText('Parcourir', { selector: 'input' }),
      new File(['x'], 'inconnu.png', { type: 'image/png' }),
    );
    const chain = screen.getByRole('region', { name: 'Chaîne d’analyse' });
    expect(await within(chain).findByRole('alert')).toHaveTextContent('étape « OCR »');
    expect(within(chain).getAllByText(/^Erreur/)).toHaveLength(2); // pastille globale + étape OCR
    expect(screen.getByText('Aucune entité à valider pour le moment.')).toBeVisible();
  });

  it('permet de rejeter une entité', async () => {
    const user = userEvent.setup();
    renderWith(<ImportScreen />, new ApiIngestionGateway('/api/ingestion', routeBackedFetch()));
    await user.upload(
      screen.getByLabelText('Parcourir', { selector: 'input' }),
      new File(['fictif'], ORDONNANCE, { type: 'image/png' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Rejeter : Lombalgie basse' }, { timeout: 5000 }),
    );
    expect(screen.getByRole('button', { name: 'Rejeter : Lombalgie basse' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
