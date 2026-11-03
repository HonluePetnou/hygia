import { ageAt } from '@hygia/fhir';
import { makeAutoObservable, runInAction } from 'mobx';
import type { LocaleSource, PatientSearchViewModel } from '@hygia/view-models';
import type { LocalStore } from '../offline/local-store.js';
import type { ConnectivityState } from './connectivity-state.js';

/** Statut de synchronisation affiché sur la carte d'un patient. */
export type PatientSyncStatus =
  | { kind: 'synced' }
  | { kind: 'pending'; count: number }
  | { kind: 'conflict' };

/** Carte patient de l'écran « Patients ». */
export interface PatientCard {
  id: string;
  initials: string;
  name: string;
  /** « 73 ans · Diabète type 2 ». */
  subtitle: string;
  reason: string;
  status: PatientSyncStatus;
  statusLabel: string;
}

/** Soignant connecté (en-tête de l'écran). */
export interface Caregiver {
  displayName: string;
  site: string;
  role: string;
}

/**
 * Écran « Patients » : recherche dans les dossiers locaux (la vue-modèle de recherche du web,
 * branchée sur SQLite), bandeau hors ligne et statut de synchronisation de chaque dossier.
 */
export class PatientsViewModel {
  total = 0;
  pendingTotal = 0;
  private pendingByPatient = new Map<string, number>();
  private conflictPatients = new Set<string>();

  constructor(
    readonly search: PatientSearchViewModel,
    private readonly store: LocalStore,
    readonly connectivity: ConnectivityState,
    private readonly i18n: LocaleSource,
    readonly caregiver: Caregiver,
    private readonly today: () => string = () => new Date().toISOString().slice(0, 10),
  ) {
    makeAutoObservable<PatientsViewModel, 'store' | 'i18n' | 'today'>(
      this,
      { store: false, i18n: false, today: false, search: false, connectivity: false },
      { autoBind: true },
    );
  }

  /** Charge la liste locale et les compteurs de file d'envoi. */
  async load(): Promise<void> {
    await this.search.search();
    const pendingTotal = await this.store.changes.pendingCount();
    const total = await this.store.patients.count();
    const pending = new Map<string, number>();
    for (const patient of this.search.results) {
      pending.set(patient.id, await this.store.changes.pendingCount(patient.id));
    }
    const conflicts = new Set((await this.store.conflicts.open()).map((c) => c.patientId));
    runInAction(() => {
      this.pendingTotal = pendingTotal;
      this.total = total;
      this.pendingByPatient = pending;
      this.conflictPatients = conflicts;
    });
  }

  get greeting(): string {
    return this.i18n.t('mobile.greeting', { nom: this.caregiver.displayName });
  }

  get profile(): string {
    return this.i18n.t('mobile.profile', { site: this.caregiver.site, role: this.caregiver.role });
  }

  get searchPlaceholder(): string {
    return this.i18n.t('mobile.patients.search', { count: this.total });
  }

  /** « 3 h 12 » : durée de la coupure en cours. */
  get duration(): string {
    const minutes = this.connectivity.offlineMinutes;
    return this.i18n.t('mobile.duration', {
      hours: Math.floor(minutes / 60),
      minutes: String(minutes % 60).padStart(2, '0'),
    });
  }

  /** Bandeau du haut d'écran : orange hors ligne, discret en ligne. */
  get banner(): { tone: 'offline' | 'online'; text: string } {
    const { t } = this.i18n;
    const count = this.pendingTotal;
    if (!this.connectivity.online) {
      const duration = this.duration;
      const text =
        count === 0
          ? t('mobile.offline.bannerEmpty', { duration })
          : t(count === 1 ? 'mobile.offline.banner.one' : 'mobile.offline.banner.other', {
              duration,
              count,
            });
      return { tone: 'offline', text };
    }
    return {
      tone: 'online',
      text:
        count === 0
          ? t('mobile.online.banner.synced')
          : t('mobile.online.banner.pending', { count }),
    };
  }

  get cards(): PatientCard[] {
    const { t } = this.i18n;
    return this.search.results.map((patient) => {
      const record = patient as typeof patient & { condition?: string; reason?: string };
      const count = this.pendingByPatient.get(patient.id) ?? 0;
      const status: PatientSyncStatus = this.conflictPatients.has(patient.id)
        ? { kind: 'conflict' }
        : count > 0
          ? { kind: 'pending', count }
          : { kind: 'synced' };
      const age = t('mobile.patient.age', { age: ageAt(patient.birthDate, this.today()) });
      return {
        id: patient.id,
        initials: `${patient.familyName.charAt(0)}${patient.givenName.charAt(0)}`.toUpperCase(),
        name: `${patient.familyName} ${patient.givenName}`,
        subtitle: record.condition === undefined ? age : `${age} · ${record.condition}`,
        reason: record.reason ?? '',
        status,
        statusLabel:
          status.kind === 'pending'
            ? t('mobile.status.pending', { count: status.count })
            : t(status.kind === 'conflict' ? 'mobile.status.conflict' : 'mobile.status.synced'),
      };
    });
  }
}
