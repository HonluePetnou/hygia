import { PatientSearchViewModel } from '@hygia/view-models';
import { describe, expect, it } from 'vitest';
import { AutoSync } from '../src/offline/auto-sync';
import { ChangeRecorder } from '../src/offline/change-recorder';
import { LocalPatientsGateway } from '../src/offline/local-patients-gateway';
import { SyncEngine } from '../src/offline/sync-engine';
import type { SyncConflict } from '../src/offline/sync-protocol';
import { DEMO_PATIENTS } from '../src/runtime/demo-patients';
import { ConnectivityState } from '../src/view-models/connectivity-state';
import { PatientsViewModel } from '../src/view-models/patients-view-model';
import { SyncViewModel } from '../src/view-models/sync-view-model';
import { VitalsEntryViewModel } from '../src/view-models/vitals-entry-view-model';
import { FakeMonitor, FakeScheduler, FakeTransport, change, fr, freshStore, settle } from './helpers';

const TODAY = '2026-11-03';
const [alhadji, moussa] = DEMO_PATIENTS;
const id = (index: 0 | 1): string => (index === 0 ? alhadji?.id : moussa?.id) ?? '';

async function setup(online = true) {
  const store = await freshStore();
  for (const patient of DEMO_PATIENTS) await store.patients.upsert(patient);
  const monitor = new FakeMonitor(online);
  let clockNow = new Date('2026-11-03T08:00:00Z');
  const now = () => clockNow;
  const connectivity = new ConnectivityState(monitor, store.meta, now);
  await connectivity.start();
  const patients = new PatientsViewModel(
    new PatientSearchViewModel(new LocalPatientsGateway(store.patients), fr),
    store,
    connectivity,
    fr,
    { displayName: 'Rose', site: 'CSI de Mora', role: 'Infirmière' },
    () => TODAY,
  );
  const recorder = new ChangeRecorder(store, 'tablette-mora', now);
  const entry = new VitalsEntryViewModel(store, recorder, fr, () => TODAY);
  const transport = new FakeTransport();
  const engine = new SyncEngine(store, transport, 'tablette-mora', now);
  const auto = new AutoSync(engine, monitor, new FakeScheduler());
  const sync = new SyncViewModel(store, engine, () => auto.syncNow(), fr, (iso) => iso.slice(11, 16));
  return { store, monitor, patients, entry, sync, transport, advance: (ms: number) => {
    clockNow = new Date(clockNow.getTime() + ms);
  } };
}

describe('écran Patients', () => {
  it('cherche dans les dossiers locaux sans réseau, accents et casse ignorés', async () => {
    const { patients } = await setup(false);
    await patients.load();
    expect(patients.cards).toHaveLength(5);
    expect(patients.searchPlaceholder).toBe('Rechercher dans les 5 dossiers locaux');
    await patients.search.setQuery('MOUSSA');
    expect(patients.cards.map((c) => c.name)).toEqual(['Moussa Abba']);
    await patients.search.setQuery('00417');
    expect(patients.cards.map((c) => c.initials)).toEqual(['KZ']);
    await patients.search.setQuery('introuvable');
    expect(patients.search.emptyMessage).toBe('Aucun patient ne correspond');
  });

  it('affiche le statut de chaque carte : en attente, conflit, synchronisé', async () => {
    const { patients, store } = await setup(false);
    await store.changes.enqueue(change({ key: 'k1', patientId: id(0) }));
    await store.changes.enqueue(change({ key: 'k2', patientId: id(0) }));
    await store.conflicts.save({
      id: 'c1',
      status: 'open',
      resourceId: 'r',
      patientId: id(1),
      field: 'posologie',
      local: change(),
      remote: change(),
    });
    await patients.load();
    const byName = Object.fromEntries(patients.cards.map((c) => [c.name, c]));
    expect(byName['Alhadji Fadimatou']?.status).toEqual({ kind: 'pending', count: 2 });
    expect(byName['Alhadji Fadimatou']?.statusLabel).toBe('2 en attente');
    expect(byName['Moussa Abba']?.status.kind).toBe('conflict');
    expect(byName['Hadjara Daouda']?.statusLabel).toBe('Synchronisé');
    expect(byName['Alhadji Fadimatou']?.subtitle).toBe('73 ans · Diabète type 2');
  });

  it('montre le bandeau « Hors ligne depuis … » avec le nombre de modifications en attente', async () => {
    const { patients, store, monitor, advance } = await setup(true);
    monitor.set(false);
    await settle();
    advance((3 * 60 + 12) * 60_000);
    await store.changes.enqueue(change({ key: 'k1' }));
    await patients.load();
    expect(patients.banner.tone).toBe('offline');
    expect(patients.banner.text).toBe(
      'Hors ligne depuis 3 h 12. 1 modification enregistrée sur l’appareil, envoyée à la reconnexion.',
    );
    monitor.set(true);
    await settle();
    expect(patients.banner).toEqual({ tone: 'online', text: 'En ligne · 1 modification(s) en attente d’envoi.' });
  });

  it('retrouve la coupure en cours après un redémarrage', async () => {
    const { store, monitor } = await setup(true);
    monitor.set(false);
    await settle();
    const restarted = new ConnectivityState(new FakeMonitor(false), store.meta, () => new Date('2026-11-03T09:30:00Z'));
    await restarted.start();
    expect(restarted.offlineSince?.toISOString()).toBe('2026-11-03T08:00:00.000Z');
    expect(restarted.offlineMinutes).toBe(90);
  });
});

describe('écran Saisie', () => {
  it('met les valeurs anormales en évidence et affiche l’horloge', async () => {
    const { entry } = await setup(false);
    await entry.open(id(0));
    expect(entry.header).toBe('Fadimatou Alhadji · 73 ans · IPP HYG-2026-00101');
    entry.setField('bp', '98/62');
    entry.setField('pulse', '112');
    entry.setField('temperature', '37,9');
    expect([...entry.abnormal].sort()).toEqual(['bp', 'pulse']);
    expect(entry.clockLabel).toBe('horloge []');
  });

  it('enregistre sur l’appareil : constantes + observation en file, horloge avancée', async () => {
    const { entry, store } = await setup(false);
    await entry.open(id(1));
    entry.setField('pulse', '112');
    entry.setNote('Déshydratation modérée');
    await entry.save();
    expect(entry.outcome).toEqual({ kind: 'saved', pending: 2 });
    expect(entry.message).toBe('Enregistré sur l’appareil · 2 en attente d’envoi');
    expect(entry.clockLabel).toBe('horloge [tablette-mora: 2]');
    const queued = (await store.changes.pending()).map((q) => [q.change.field, q.change.value]);
    expect(queued).toEqual([
      ['vitals', { pulse: 112 }],
      ['observations', 'Déshydratation modérée'],
    ]);
    expect(entry.input.pulse).toBe('');
  });

  it('refuse une saisie vide ou invalide sans rien mettre en file', async () => {
    const { entry, store } = await setup(false);
    await entry.open(id(0));
    await entry.save();
    expect(entry.message).toBe('Saisissez au moins une constante ou une observation.');
    entry.setField('bp', 'abc');
    await entry.save();
    expect(entry.message).toBe('Valeur invalide : Tension');
    expect(await store.changes.pendingCount()).toBe(0);
  });
});

describe('écran Synchro', () => {
  const conflict = (): SyncConflict => ({
    id: 'c1',
    status: 'open',
    resourceId: 'MedicationRequest/furo',
    patientId: id(1),
    field: 'posologie',
    local: change({ kind: 'set', field: 'posologie', value: '40 mg · 1×/j', nodeId: 'tablette-mora', clock: { 'tablette-mora': 19, serveur: 40 }, at: '2026-11-03T08:40:00Z' }),
    remote: change({ kind: 'set', field: 'posologie', value: '20 mg · 1×/j', nodeId: 'dr-nana', clock: { 'tablette-mora': 18, serveur: 42 }, at: '2026-11-03T09:05:00Z' }),
  });

  it('résume les modifications fusionnées et présente le conflit côte à côte', async () => {
    const { sync, store, entry, transport } = await setup(true);
    await entry.open(id(0));
    entry.setNote('RAS');
    await entry.save();
    transport.respond = (request) => ({ merged: request.changes, conflicts: [conflict()] });
    await sync.synchronise();
    expect(sync.mergedTitle).toBe('1 modification fusionnée');
    expect(sync.mergedRows).toEqual(['Observation · Alhadji Fadimatou · 08:00']);
    expect(sync.conflictsTitle).toBe('1 conflit à arbitrer');
    const [card] = sync.conflictCards;
    expect(card?.heading).toBe('POSOLOGIE · MOUSSA ABBA');
    expect(card?.chosen).toBe('remote');
    expect(card?.sides.map((s) => [s.author, s.time, s.value, s.clock])).toEqual([
      ['tablette-mora · tablette', '08:40', '40 mg · 1×/j', '[tablette-mora: 19, serveur: 40]'],
      ['dr-nana · serveur', '09:05', '20 mg · 1×/j', '[tablette-mora: 18, serveur: 42]'],
    ]);
    expect((await store.conflicts.open()).map((c) => c.id)).toEqual(['c1']);
  });

  it('« Appliquer ce choix » passe par le service puis ferme le conflit', async () => {
    const { sync, store, transport } = await setup(true);
    await store.conflicts.save(conflict());
    await sync.refresh();
    sync.choose('c1', 'local');
    expect(sync.conflictCards[0]?.chosen).toBe('local');
    await sync.apply('c1');
    expect(transport.arbitrations).toEqual([{ id: 'c1', choice: 'local' }]);
    expect(sync.conflicts).toEqual([]);
  });

  it('annonce l’échec et le délai de la reprise automatique', async () => {
    const { sync } = await setup(true);
    sync.handle({ type: 'failure', retryInMs: 4_000 });
    expect(sync.failureLabel).toBe('Envoi impossible · nouvel essai automatique dans 4 s');
    sync.handle({ type: 'success', report: null });
    expect(sync.failureLabel).toBe('');
  });
});
