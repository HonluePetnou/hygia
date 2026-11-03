import { describe, expect, it } from 'vitest';
import { FLORENCE_ID, demoDataset } from '@hygia/fhir';
import {
  InMemoryPatientsGateway,
  SessionViewModel,
  VersionsViewModel,
  type ResourceVersion,
} from '../src/index.js';

const DOC = 'doc-1';
const version = (number: number, title: string, reason: string): ResourceVersion => ({
  resourceId: DOC,
  resourceType: 'DocumentReference',
  number,
  author: number === 1 ? 'système' : 'dr-nana',
  createdAt: `2026-11-0${number}T09:00:00Z`,
  reason,
  content: { id: DOC, resourceType: 'DocumentReference', version: number, title, language: 'fr' },
});

class StubGateway extends InMemoryPatientsGateway {
  override versions(): Promise<ResourceVersion[]> {
    return Promise.resolve([
      version(3, 'Titre C', 'relecture'),
      version(2, 'Titre B', 'correction'),
      version(1, 'Titre A', 'état initial'),
      { ...version(1, 'Fiche', 'état initial'), resourceId: 'pat', resourceType: 'Patient' },
    ]);
  }
}

describe('VersionsViewModel', () => {
  it('liste les versions et compare deux versions en surlignant les champs modifiés', async () => {
    const vm = new VersionsViewModel(new StubGateway(demoDataset), new SessionViewModel());
    await vm.load(FLORENCE_ID);
    expect(vm.state).toBe('ready');
    expect(vm.rows[0]).toMatchObject({ numberLabel: 'Version 3', title: 'Titre C', reason: 'relecture' });
    expect(vm.rows[2]?.authorLabel).toBe('Système');
    expect(vm.comparison).toBeNull();

    vm.toggle(`${DOC}@3`);
    vm.toggle(`${DOC}@1`);
    const comparison = vm.comparison;
    expect(comparison?.leftLabel).toBe('Version 1');
    expect(comparison?.rightLabel).toBe('Version 3');
    expect(comparison?.rows.filter((r) => r.changed).map((r) => r.field)).toEqual(['version', 'title']);
    expect(comparison?.rows.find((r) => r.field === 'title')).toMatchObject({
      label: 'Titre',
      left: 'Titre A',
      right: 'Titre C',
    });
    expect(comparison?.rows.find((r) => r.field === 'language')?.changed).toBe(false);
  });

  it('limite la sélection à deux versions d’une même ressource', async () => {
    const vm = new VersionsViewModel(new StubGateway(demoDataset), new SessionViewModel());
    await vm.load(FLORENCE_ID);
    vm.toggle(`${DOC}@1`);
    vm.toggle(`${DOC}@2`);
    vm.toggle(`${DOC}@3`);
    expect(vm.selectedKeys).toEqual([`${DOC}@2`, `${DOC}@3`]);
    vm.toggle('pat@1');
    expect(vm.selectedKeys).toEqual(['pat@1']);
    vm.toggle('pat@1');
    expect(vm.selectedKeys).toEqual([]);
  });

  it('hors ligne : une version par ressource, fiche patient comprise', async () => {
    const gateway = new InMemoryPatientsGateway(demoDataset, () => '2026-10-28');
    const versions = await gateway.versions(FLORENCE_ID);
    expect(versions.filter((v) => v.resourceType === 'Patient')).toHaveLength(1);
    expect(versions.filter((v) => v.resourceType === 'DocumentReference')).toHaveLength(5);
  });
});
