import { ChangeLog } from './change-log.js';
import { PatientStore } from './patient-store.js';
import { SCHEMA_SQL, type SqlDatabase } from './sql-database.js';
import { ClockStore, ConflictStore, MetaStore } from './small-stores.js';

/** Base locale de l'appareil : tout ce qui survit à une coupure et à un redémarrage. */
export interface LocalStore {
  patients: PatientStore;
  changes: ChangeLog;
  clocks: ClockStore;
  conflicts: ConflictStore;
  meta: MetaStore;
}

/** Crée le schéma s'il manque et assemble les dépôts. */
export async function openLocalStore(db: SqlDatabase): Promise<LocalStore> {
  await db.exec(SCHEMA_SQL);
  return {
    patients: new PatientStore(db),
    changes: new ChangeLog(db),
    clocks: new ClockStore(db),
    conflicts: new ConflictStore(db),
    meta: new MetaStore(db),
  };
}
