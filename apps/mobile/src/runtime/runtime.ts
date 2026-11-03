import { createTranslator, type Locale } from '@hygia/i18n';
import { PatientSearchViewModel, type LocaleSource } from '@hygia/view-models';
import { openDatabaseAsync } from 'expo-sqlite';
import { AutoSync, type AutoSyncEvent } from '../offline/auto-sync.js';
import { ChangeRecorder } from '../offline/change-recorder.js';
import { ExpoSqlDatabase } from '../offline/expo-sqlite-database.js';
import { HttpSyncTransport } from '../offline/http-sync-transport.js';
import { LocalPatientsGateway } from '../offline/local-patients-gateway.js';
import { openLocalStore, type LocalStore } from '../offline/local-store.js';
import { ReachabilityMonitor } from '../offline/reachability-monitor.js';
import { SyncEngine } from '../offline/sync-engine.js';
import type { Scheduler } from '../offline/sync-protocol.js';
import { ConnectivityState } from '../view-models/connectivity-state.js';
import { PatientsViewModel } from '../view-models/patients-view-model.js';
import { SyncViewModel } from '../view-models/sync-view-model.js';
import { VitalsEntryViewModel } from '../view-models/vitals-entry-view-model.js';
import { readConfig } from './config.js';
import { DEMO_PATIENTS } from './demo-patients.js';

/** Tout ce dont les écrans ont besoin, assemblé une seule fois au démarrage. */
export interface Runtime {
  store: LocalStore;
  patients: PatientsViewModel;
  entry: VitalsEntryViewModel;
  sync: SyncViewModel;
  stop: () => void;
}

const scheduler: Scheduler = {
  after(delayMs, task) {
    const handle = setTimeout(task, delayMs);
    return () => clearTimeout(handle);
  },
};

/** Identifiant stable de ce terminal (compteur de son horloge vectorielle). */
async function nodeIdOf(store: LocalStore): Promise<string> {
  const known = await store.meta.get('nodeId');
  if (known !== undefined) return known;
  const created = `tablette-${Math.random().toString(36).slice(2, 8)}`;
  await store.meta.set('nodeId', created);
  return created;
}

/** Ouvre la base locale, charge les dossiers de démonstration au premier lancement et assemble les vues-modèles. */
export async function createRuntime(locale: Locale = 'fr'): Promise<Runtime> {
  const config = readConfig({
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_ACCESS_TOKEN: process.env.EXPO_PUBLIC_ACCESS_TOKEN,
    EXPO_PUBLIC_PROBE_INTERVAL_MS: process.env.EXPO_PUBLIC_PROBE_INTERVAL_MS,
  });
  const store = await openLocalStore(new ExpoSqlDatabase(await openDatabaseAsync(config.databaseName)));
  if ((await store.patients.count()) === 0) {
    for (const patient of DEMO_PATIENTS) await store.patients.upsert(patient);
  }
  const i18n: LocaleSource = { locale, t: createTranslator(locale) };
  const nodeId = await nodeIdOf(store);

  const monitor = new ReachabilityMonitor(
    async () => (await fetch(`${config.apiUrl}/health`)).ok,
    scheduler,
    config.probeIntervalMs,
  );
  const connectivity = new ConnectivityState(monitor, store.meta);
  const transport = new HttpSyncTransport(`${config.apiUrl}/api/synchronisation`, () => config.accessToken);
  const engine = new SyncEngine(store, transport, nodeId);

  // La vue-modèle Synchro écoute la reprise automatique, qui elle-même est appelée par la vue-modèle.
  const listeners: ((event: AutoSyncEvent) => void)[] = [];
  const autoSync = new AutoSync(engine, monitor, scheduler, (event) => {
    for (const listener of listeners) listener(event);
  });
  const syncModel = new SyncViewModel(store, engine, () => autoSync.syncNow(), i18n);
  listeners.push((event) => syncModel.handle(event));

  const patients = new PatientsViewModel(
    new PatientSearchViewModel(new LocalPatientsGateway(store.patients), i18n),
    store,
    connectivity,
    i18n,
    { displayName: 'Rose', site: 'CSI de Mora', role: 'Infirmière' },
  );
  const entry = new VitalsEntryViewModel(store, new ChangeRecorder(store, nodeId), i18n);

  const stopConnectivity = await connectivity.start();
  monitor.start();
  autoSync.start();
  return {
    store,
    patients,
    entry,
    sync: syncModel,
    stop: () => {
      autoSync.stop();
      monitor.stop();
      stopConnectivity();
    },
  };
}
