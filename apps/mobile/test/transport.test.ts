import { describe, expect, it } from 'vitest';
import { HttpSyncTransport, type Fetcher } from '../src/offline/http-sync-transport';
import { ReachabilityMonitor } from '../src/offline/reachability-monitor';
import { readConfig } from '../src/runtime/config';
import { FakeScheduler, settle } from './helpers';

describe('transport HTTP', () => {
  it('envoie le lot au service Synchronisation avec le jeton, via le broker', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetcher: Fetcher = (url, init) => {
      calls.push({ url, init });
      return Promise.resolve(new Response(JSON.stringify({ merged: [], remote: [], conflicts: [], duplicates: 0, clocks: {} })));
    };
    const transport = new HttpSyncTransport('http://broker:3000/api/synchronisation/', () => 'jwt', fetcher);
    await transport.push({ nodeId: 'tab', changes: [], clocks: {} });
    await transport.arbitrate('c 1', 'local');
    expect(calls[0]?.url).toBe('http://broker:3000/api/synchronisation/sync');
    expect(calls[1]?.url).toBe('http://broker:3000/api/synchronisation/sync/conflits/c%201/arbitrage');
    expect((calls[0]?.init.headers as Record<string, string>)['authorization']).toBe('Bearer jwt');
    expect(JSON.parse(calls[1]?.init.body as string)).toEqual({ choice: 'local' });
  });

  it('rejette sur une réponse en erreur (la file reste alors intacte)', async () => {
    const transport = new HttpSyncTransport('http://b', () => undefined, () => Promise.resolve(new Response('', { status: 503 })));
    await expect(transport.push({ nodeId: 'tab', changes: [], clocks: {} })).rejects.toThrow('HTTP 503');
  });
});

describe('moniteur de connexion', () => {
  it('notifie chaque changement d’état de la sonde, et seulement ceux-là', async () => {
    let reachable = true;
    const scheduler = new FakeScheduler();
    const monitor = new ReachabilityMonitor(() => (reachable ? Promise.resolve(true) : Promise.reject(new Error('x'))), scheduler, 1_000);
    const seen: boolean[] = [];
    monitor.subscribe((online) => seen.push(online));
    monitor.start();
    await settle();
    reachable = false;
    scheduler.advance(1_000);
    await settle();
    scheduler.advance(1_000);
    await settle();
    reachable = true;
    scheduler.advance(1_000);
    await settle();
    expect(seen).toEqual([false, true]);
    monitor.stop();
  });
});

describe('configuration', () => {
  it('applique les valeurs par défaut et valide l’environnement', () => {
    expect(readConfig({}).apiUrl).toBe('http://localhost:3000');
    expect(() => readConfig({ EXPO_PUBLIC_API_URL: 'ftp://x' })).toThrow('invalide');
    expect(() => readConfig({ EXPO_PUBLIC_PROBE_INTERVAL_MS: '10' })).toThrow('≥ 500');
  });
});
