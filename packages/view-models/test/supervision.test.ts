import { describe, expect, it } from 'vitest';
import {
  GatewayError,
  HttpSupervisionGateway,
  InMemorySupervisionGateway,
  SessionViewModel,
  SupervisionViewModel,
  formatLatency,
  type SupervisionGateway,
} from '../src/index.js';

describe('SupervisionViewModel', () => {
  it('affiche 8 services avec leurs zones et leur p95, sans bandeau hors exercice', async () => {
    const vm = new SupervisionViewModel(new InMemorySupervisionGateway(), new SessionViewModel());
    await vm.load();
    expect(vm.state).toBe('ready');
    expect(vm.cards).toHaveLength(8);
    expect(vm.cards[0]).toMatchObject({ name: 'Dossiers patients', runtime: 'ECS Fargate · NestJS', p95Label: 'p95 182 ms' });
    expect(vm.cards[0]?.zones.map((z) => z.label)).toEqual(['3a', '3b']);
    expect(vm.cards[2]).toMatchObject({ name: 'IA clinique', p95Label: 'p95 1,4 s', slow: true });
    expect(vm.banner).toBeNull();
    expect(vm.sloMet).toBe(true);
    expect(vm.chart?.line.startsWith('M')).toBe(true);
  });

  it('lance et arrête une expérience : bandeau, instances retirées, bouton Arrêter l’exercice', async () => {
    const vm = new SupervisionViewModel(new InMemorySupervisionGateway(), new SessionViewModel());
    await vm.load();
    await vm.toggle('zone-cut');
    expect(vm.experiments.find((e) => e.id === 'zone-cut')?.active).toBe(true);
    expect(vm.banner).toEqual({
      title: 'Zone eu-west-3a coupée depuis 11:14', // 10:14 UTC, heure du Cameroun
      detail: 'Trafic redirigé vers l’autre zone · 3 requêtes basculées · 0 erreur côté utilisateur',
    });
    expect(vm.cards.every((c) => c.zones[0]?.up === false && c.zones[1]?.up === true)).toBe(true);
    await vm.toggle('zone-cut');
    expect(vm.banner).toBeNull();
    await vm.toggle('llm-down');
    await vm.toggle('latency');
    expect(vm.banner?.title).toBe('Modèle de langage indisponible depuis 11:14');
    expect(vm.banner?.detail).toContain('mode dégradé : recherche simple');
    await vm.stopExercise();
    expect(vm.experiments.every((e) => !e.active)).toBe(true);
    expect(vm.busy).toBeNull();
  });

  it('403 → forbidden ; échec d’une action → actionFailed sans perdre les données', async () => {
    const forbidden: SupervisionGateway = {
      load: () => Promise.reject(new GatewayError(403, 'GET')),
      start: () => Promise.reject(new GatewayError(403, 'POST')),
      stop: () => Promise.reject(new GatewayError(403, 'POST')),
      stopExercise: () => Promise.reject(new GatewayError(403, 'POST')),
    };
    const denied = new SupervisionViewModel(forbidden, new SessionViewModel());
    await denied.load();
    expect(denied.state).toBe('forbidden');

    const memory = new InMemorySupervisionGateway();
    const vm = new SupervisionViewModel({ ...memory, load: () => memory.load(), start: () => Promise.reject(new GatewayError(500, 'POST')), stop: (id) => memory.stop(id), stopExercise: () => memory.stopExercise() }, new SessionViewModel());
    await vm.load();
    await vm.toggle('latency');
    expect(vm.actionFailed).toBe(true);
    expect(vm.state).toBe('ready');
    expect(vm.cards).toHaveLength(8);
  });
});

describe('formatLatency', () => {
  it('ms sous la seconde, secondes au-delà (virgule en français)', () => {
    expect(formatLatency(182, 'fr')).toBe('182 ms');
    expect(formatLatency(1400, 'fr')).toBe('1,4 s');
    expect(formatLatency(2100, 'en')).toBe('2.1 s');
  });
});

describe('HttpSupervisionGateway', () => {
  it('appelle /supervision avec le jeton puis les routes d’expérience en POST', async () => {
    const calls: { url: string; method: string; auth: string | undefined }[] = [];
    const fetchFn = ((input: string, init?: RequestInit) => {
      calls.push({ url: input, method: init?.method ?? 'GET', auth: (init?.headers as Record<string, string>)['authorization'] });
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as unknown as typeof fetch;
    const gateway = new HttpSupervisionGateway('http://broker/api/supervision', () => ({ userId: 'admin-1', role: 'admin', token: 'jwt' }), fetchFn);
    await gateway.load();
    await gateway.start('zone-cut');
    await gateway.stop('latency');
    await gateway.stopExercise();
    expect(calls).toEqual([
      { url: 'http://broker/api/supervision', method: 'GET', auth: 'Bearer jwt' },
      { url: 'http://broker/api/supervision/experiments/zone-cut/start', method: 'POST', auth: 'Bearer jwt' },
      { url: 'http://broker/api/supervision/experiments/latency/stop', method: 'POST', auth: 'Bearer jwt' },
      { url: 'http://broker/api/supervision/exercise/stop', method: 'POST', auth: 'Bearer jwt' },
    ]);
  });
});
