import { FLORENCE_ID } from '@hygia/fhir';
import { describe, expect, it } from 'vitest';
import {
  GatewayError,
  HttpReadmissionGateway,
  InMemoryReadmissionGateway,
  ReadmissionViewModel,
  deriveReadmissionFactors,
  type ReadmissionRecord,
} from '../src/index.js';

const NOW = new Date('2026-10-28T09:00:00Z');
const record: ReadmissionRecord = {
  patient: {
    id: FLORENCE_ID,
    ipp: 'IPP-1',
    familyName: 'BASSA',
    givenName: 'Florence',
    birthDate: '1944-03-02',
  },
  timeline: [
    { type: 'consultation', date: '2026-09-01', resource: { reference: 'Encounter/1' }, label: 'Suivi', detail: 'Insuffisance cardiaque' },
    { type: 'consultation', date: '2026-05-01', resource: { reference: 'Encounter/2' }, label: 'Contrôle' },
    { type: 'consultation', date: '2024-01-01', resource: { reference: 'Encounter/3' }, label: 'Ancien' },
    { type: 'examen', date: '2026-09-02', resource: { reference: 'Observation/1' }, label: 'Bilan' },
  ],
  treatments: [
    { label: 'A', dosage: '', flagged: false },
    { label: 'B', dosage: '', flagged: false },
  ],
  summary: null,
};

describe('facteurs du modèle', () => {
  it('sont anonymes et calculés depuis le dossier', () => {
    const factors = deriveReadmissionFactors(record, NOW);
    expect(factors).toEqual({
      age: 82,
      hospitalisations: 2,
      traitements: 2,
      insuffisanceCardiaque: 1,
      diabete: 0,
    });
    expect(JSON.stringify(factors)).not.toMatch(/BASSA|Florence|1944/);
  });
});

describe('ReadmissionViewModel', () => {
  it('estime le risque et expose les trois facteurs principaux triés', async () => {
    const vm = new ReadmissionViewModel(new InMemoryReadmissionGateway(), () => NOW);
    await vm.load(FLORENCE_ID, record);
    expect(vm.state).toBe('ready');
    expect(vm.topFactors).toHaveLength(3);
    const weights = vm.estimate!.facteurs.map((f) => Math.abs(f.contribution));
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
    expect(vm.estimate!.score).toBeGreaterThan(0);
  });

  it('signale le consentement « statistiques » révoqué', async () => {
    const vm = new ReadmissionViewModel(new InMemoryReadmissionGateway(true), () => NOW);
    await vm.load(FLORENCE_ID, record);
    expect(vm.state).toBe('consentRevoked');
    expect(vm.estimate).toBeNull();
  });

  it('la passerelle HTTP envoie l’identifiant à part des facteurs', async () => {
    const calls: { url: string; body: string }[] = [];
    const fetchFn = (async (url: string, init: { body: string }) => {
      calls.push({ url, body: init.body });
      return new Response(JSON.stringify({ score: 0.2, niveau: 'modere', facteurs: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const gateway = new HttpReadmissionGateway('http://broker/api/agents', () => ({ userId: 'u', role: 'medecin' }), fetchFn);
    await gateway.estimate('p1', deriveReadmissionFactors(record, NOW));
    expect(calls[0]!.url).toBe('http://broker/api/agents/readmission');
    expect(JSON.parse(calls[0]!.body)).toMatchObject({ patientId: 'p1', facteurs: { age: 82 } });
    await expect(
      new HttpReadmissionGateway('http://x', () => ({ userId: 'u', role: 'medecin' }), (async () => new Response('', { status: 403 })) as unknown as typeof fetch).estimate('p1', deriveReadmissionFactors(record, NOW)),
    ).rejects.toBeInstanceOf(GatewayError);
  });
});
