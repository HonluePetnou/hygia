import { demoDataset } from '@hygia/fhir';
import { describe, expect, it } from 'vitest';
import {
  AlertsViewModel,
  InMemoryPatientsGateway,
  OpenAlertsViewModel,
  SessionViewModel,
} from '../src/index.js';

const setup = () => {
  const gateway = new InMemoryPatientsGateway(demoDataset, () => '2026-11-02');
  const session = new SessionViewModel();
  const vm = new AlertsViewModel(gateway, session, () => new Date('2026-11-02T10:32:00Z'));
  return { gateway, session, vm };
};

describe('AlertsViewModel', () => {
  it('charge les alertes ouvertes, sélectionne la première et détaille son raisonnement', async () => {
    const { vm } = setup();
    await vm.load();
    expect(vm.tabLabel('ouvertes')).toBe('Ouvertes · 4');
    expect(vm.rows[0]).toMatchObject({ agentLabel: 'Pharmacovigilance', patientName: 'Florence Ngo Bassa', age: '6 min', selected: true });
    const detail = vm.detailView;
    expect(detail?.severityLabel).toBe('Critique');
    expect(detail?.steps.map((s) => s.step)).toEqual([1, 2, 3, 4]);
    expect(detail?.patientCard).toMatchObject({ name: 'Florence Ngo Bassa', age: '71 ans' });
    expect(detail?.precision).toMatch(/pas encore de retour/);
  });

  it('refuse un rejet sans justification, sans appeler le service', async () => {
    const { vm, gateway } = setup();
    await vm.load();
    await vm.decide('rejeter');
    expect(vm.decisionErrorMessage).toBe('Une justification est obligatoire pour rejeter une alerte.');
    expect(await gateway.alerts('rejetees')).toHaveLength(0);
    vm.setJustification('patiente déjà prévenue');
    expect(vm.decisionErrorMessage).toBeNull();
  });

  it('enregistre la décision, met à jour les onglets et la précision', async () => {
    const { vm } = setup();
    await vm.load();
    const firstId = vm.selectedId as string;
    vm.setJustification('AINS arrêté');
    await vm.decide('rejeter');
    expect(vm.tabLabel('ouvertes')).toBe('Ouvertes · 3');
    expect(vm.selectedId).not.toBe(firstId);
    await vm.selectTab('rejetees');
    expect(vm.selectedId).toBe(firstId);
    expect(vm.detailView?.decided?.justification).toBe('Justification : AINS arrêté');
    expect(vm.detailView?.precision).toContain('0 %');
    await vm.selectTab('ouvertes');
    await vm.decide('accepter_notifier');
    await vm.selectTab('acceptees');
    expect(vm.detailView?.decided?.text).toMatch(/prescripteur a été notifié/);
  });
});

describe('OpenAlertsViewModel', () => {
  it('compte les alertes ouvertes', async () => {
    const { gateway } = setup();
    const count = new OpenAlertsViewModel(gateway);
    await count.refresh();
    expect(count.count).toBe(4);
  });
});
