import { describe, expect, it } from 'vitest';
import { AutoSync, type AutoSyncEvent } from '../src/offline/auto-sync';
import { ChangeRecorder } from '../src/offline/change-recorder';
import { SyncEngine } from '../src/offline/sync-engine';
import { FakeMonitor, FakeScheduler, FakeTransport, change, freshStore, settle } from './helpers';

describe('file d’envoi locale', () => {
  it('ignore une clé déjà en file (idempotence) et compte les changements en attente', async () => {
    const store = await freshStore();
    await store.changes.enqueue(change());
    await store.changes.enqueue(change());
    await store.changes.enqueue(change({ key: 'tab:Dossier/p2:1', patientId: 'p2' }));
    expect(await store.changes.pendingCount()).toBe(2);
    expect(await store.changes.pendingCount('p1')).toBe(1);
  });

  it('incrémente l’horloge du terminal et garde une clé stable par changement', async () => {
    const store = await freshStore();
    const recorder = new ChangeRecorder(store, 'tab', () => new Date('2026-11-03T08:00:00Z'));
    const first = await recorder.record('p1', 'Dossier/p1', 'add', 'observations', 'a');
    const second = await recorder.record('p1', 'Dossier/p1', 'add', 'observations', 'b');
    expect(first.clock).toEqual({ tab: 1 });
    expect(second.clock).toEqual({ tab: 2 });
    expect(new Set([first.key, second.key]).size).toBe(2);
    expect(await store.clocks.get('Dossier/p1')).toEqual({ tab: 2 });
  });

  it('envoie la file par lots dans l’ordre, la vide et conserve le bilan', async () => {
    const store = await freshStore();
    for (let i = 1; i <= 5; i += 1) {
      await store.changes.enqueue(change({ key: `tab:r:${i}`, value: `n${i}` }));
    }
    const transport = new FakeTransport();
    const engine = new SyncEngine(store, transport, 'tab', () => new Date('2026-11-03T11:52:00Z'), 2);
    const report = await engine.flush();
    expect(transport.requests.map((r) => r.changes.length)).toEqual([2, 2, 1]);
    expect(transport.requests[0]?.changes.map((c) => c.key)).toEqual(['tab:r:1', 'tab:r:2']);
    expect(report?.merged).toHaveLength(5);
    expect(await store.changes.pendingCount()).toBe(0);
    expect(JSON.parse((await store.meta.get('lastReport')) ?? '{}').at).toBe('2026-11-03T11:52:00.000Z');
  });

  it('ne perd rien si l’envoi échoue : la file reste intacte, puis un rejeu aboutit', async () => {
    const store = await freshStore();
    await store.changes.enqueue(change());
    const transport = new FakeTransport();
    transport.failures = 1;
    const engine = new SyncEngine(store, transport, 'tab');
    await expect(engine.flush()).rejects.toThrow('réseau coupé');
    expect(await store.changes.pendingCount()).toBe(1);
    expect((await store.changes.pending())[0]?.attempts).toBe(1);
    await engine.flush();
    expect(await store.changes.pendingCount()).toBe(0);
    expect(transport.requests[1]?.changes[0]?.key).toBe(transport.requests[0]?.changes[0]?.key);
  });

  it('ne fait aucun appel quand la file est vide', async () => {
    const transport = new FakeTransport();
    const engine = new SyncEngine(await freshStore(), transport, 'tab');
    expect(await engine.flush()).toBeNull();
    expect(transport.requests).toHaveLength(0);
  });

  it('enregistre les changements du serveur, les conflits et fusionne les horloges', async () => {
    const store = await freshStore();
    await store.clocks.set('Dossier/p1', { tab: 1 });
    await store.changes.enqueue(change());
    const transport = new FakeTransport();
    const remote = change({ key: 'srv:Dossier/p1:1', nodeId: 'srv', clock: { srv: 1 } });
    transport.respond = (request) => ({
      merged: request.changes,
      remote: [remote],
      clocks: { 'Dossier/p1': { srv: 1, tab: 1 } },
    });
    await new SyncEngine(store, transport, 'tab').flush();
    expect((await store.changes.ofPatient('p1')).map((c) => c.key)).toEqual([
      'tab:Dossier/p1:1',
      'srv:Dossier/p1:1',
    ]);
    expect(await store.changes.pendingCount()).toBe(0);
    expect(await store.clocks.get('Dossier/p1')).toEqual({ srv: 1, tab: 1 });
  });
});

describe('reprise automatique', () => {
  const setup = async (online: boolean) => {
    const store = await freshStore();
    await store.changes.enqueue(change());
    const transport = new FakeTransport();
    const monitor = new FakeMonitor(online);
    const scheduler = new FakeScheduler();
    const events: AutoSyncEvent[] = [];
    const auto = new AutoSync(
      new SyncEngine(store, transport, 'tab'),
      monitor,
      scheduler,
      (e) => events.push(e),
      1_000,
      4_000,
    );
    return { store, transport, monitor, scheduler, events, auto };
  };

  it('envoie à la reconnexion, pas avant', async () => {
    const { store, transport, monitor, auto } = await setup(false);
    auto.start();
    await settle();
    expect(transport.requests).toHaveLength(0);
    monitor.set(true);
    await settle();
    expect(transport.requests).toHaveLength(1);
    expect(await store.changes.pendingCount()).toBe(0);
  });

  it('réessaie avec un délai doublé (plafonné) tant que l’envoi échoue', async () => {
    const { transport, scheduler, events, auto } = await setup(true);
    transport.failures = 4;
    auto.start();
    await settle();
    for (let i = 0; i < 4; i += 1) {
      scheduler.advance(10_000);
      await settle();
    }
    expect(scheduler.delays).toEqual([1_000, 2_000, 4_000, 4_000]);
    expect(events.at(-1)).toEqual({ type: 'success', report: expect.anything() });
    expect(transport.requests).toHaveLength(5);
  });

  it('n’arme aucune relance hors connexion et s’arrête proprement', async () => {
    const { transport, monitor, scheduler, auto } = await setup(true);
    transport.failures = 1;
    auto.start();
    await settle();
    monitor.set(false);
    scheduler.advance(10_000);
    await settle();
    expect(transport.requests).toHaveLength(1);
    auto.stop();
    monitor.set(true);
    await settle();
    expect(transport.requests).toHaveLength(1);
  });
});
