import { render, screen } from '@testing-library/react';
import { FLORENCE_ID, demoDataset } from '@hygia/fhir';
import {
  InMemoryPatientsGateway,
  InMemoryReadmissionGateway,
  SessionViewModel,
} from '@hygia/view-models';
import { describe, expect, it, vi } from 'vitest';
import { PatientScreen } from '@/components/patient/PatientScreen';
import { GatewayProvider } from '@/lib/gateway-context';
import { SessionProvider } from '@/lib/session-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/',
}));

function renderRecord(readmission: InMemoryReadmissionGateway, role: 'medecin' | 'administratif' = 'medecin') {
  const patients = new InMemoryPatientsGateway(demoDataset, () => '2026-10-28');
  render(
    <SessionProvider session={new SessionViewModel({ role })}>
      <GatewayProvider gateway={patients} readmission={readmission}>
        <PatientScreen patientId={FLORENCE_ID} />
      </GatewayProvider>
    </SessionProvider>,
  );
}

describe('carte « Risque de réadmission à 30 jours »', () => {
  it('affiche la jauge, trois facteurs et la mention « aide à la décision »', async () => {
    renderRecord(new InMemoryReadmissionGateway());
    const title = await screen.findByRole('heading', { name: 'Risque de réadmission à 30 jours' });
    expect(await screen.findByRole('meter')).toBeVisible();
    const card = title.closest('.card') as HTMLElement;
    expect(card.querySelectorAll('.risk-factors li')).toHaveLength(3);
    expect(card).toHaveTextContent('aide à la décision');
  });

  it('explique l’absence d’estimation si le consentement « statistiques » est révoqué', async () => {
    renderRecord(new InMemoryReadmissionGateway(true));
    expect(await screen.findByText(/révoqué son consentement « statistiques »/)).toBeVisible();
    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('n’apparaît pas pour un profil sans accès clinique', async () => {
    renderRecord(new InMemoryReadmissionGateway(), 'administratif');
    await screen.findByText('Équipe de soins');
    expect(screen.queryByText('Risque de réadmission à 30 jours')).toBeNull();
  });
});
