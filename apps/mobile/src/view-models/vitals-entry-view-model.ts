import { ageAt } from '@hygia/fhir';
import { makeAutoObservable, runInAction } from 'mobx';
import type { LocaleSource } from '@hygia/view-models';
import type { ChangeRecorder } from '../offline/change-recorder.js';
import { dossierResource } from '../offline/change-recorder.js';
import type { LocalStore } from '../offline/local-store.js';
import {
  VITAL_FIELDS,
  emptyVitalsInput,
  isAbnormal,
  parseVitals,
  type VitalField,
  type VitalsInput,
} from '../offline/vitals.js';

/** Résultat de la dernière tentative d'enregistrement. */
export type EntryOutcome =
  | { kind: 'none' }
  | { kind: 'saved'; pending: number }
  | { kind: 'invalid'; fields: VitalField[] }
  | { kind: 'empty' };

/**
 * Écran « Saisie » : constantes d'un patient et observation de soins, enregistrées sur
 * l'appareil (file d'envoi), avec l'horloge vectorielle de la ressource.
 */
export class VitalsEntryViewModel {
  patientId: string | null = null;
  input: VitalsInput = emptyVitalsInput();
  note = '';
  clock: Record<string, number> = {};
  outcome: EntryOutcome = { kind: 'none' };
  header = '';

  constructor(
    private readonly store: LocalStore,
    private readonly recorder: ChangeRecorder,
    private readonly i18n: LocaleSource,
    private readonly today: () => string = () => new Date().toISOString().slice(0, 10),
  ) {
    makeAutoObservable<VitalsEntryViewModel, 'store' | 'recorder' | 'i18n' | 'today'>(
      this,
      { store: false, recorder: false, i18n: false, today: false },
      { autoBind: true },
    );
  }

  /** Ouvre la saisie d'un patient du téléphone (formulaire vidé). */
  async open(patientId: string): Promise<void> {
    const patient = await this.store.patients.get(patientId);
    const clock = await this.store.clocks.get(dossierResource(patientId));
    runInAction(() => {
      this.patientId = patientId;
      this.input = emptyVitalsInput();
      this.note = '';
      this.outcome = { kind: 'none' };
      this.clock = { ...clock };
      this.header =
        patient === undefined
          ? ''
          : this.i18n.t('mobile.entry.subtitle', {
              name: `${patient.givenName} ${patient.familyName}`,
              age: ageAt(patient.birthDate, this.today()),
              ipp: patient.ipp,
            });
    });
  }

  setField(field: VitalField, text: string): void {
    this.input[field] = text;
    this.outcome = { kind: 'none' };
  }

  setNote(text: string): void {
    this.note = text;
  }

  /** Constantes dont la valeur saisie sort de la plage usuelle (affichées en orange). */
  get abnormal(): ReadonlySet<VitalField> {
    const { reading } = parseVitals(this.input);
    return new Set(VITAL_FIELDS.filter((field) => isAbnormal(field, reading)));
  }

  /** « horloge [tablette-mora: 18, serveur: 41] ». */
  get clockLabel(): string {
    const entries = Object.entries(this.clock).map(([node, count]) => `${node}: ${count}`);
    return this.i18n.t('mobile.entry.clock', { clock: `[${entries.join(', ')}]` });
  }

  /** Message du dernier enregistrement, ou chaîne vide. */
  get message(): string {
    const { t } = this.i18n;
    switch (this.outcome.kind) {
      case 'saved':
        return t('mobile.entry.saved', { count: this.outcome.pending });
      case 'empty':
        return t('mobile.entry.empty');
      case 'invalid':
        return t('mobile.entry.invalid', {
          field: this.outcome.fields.map((f) => t(`mobile.vital.${f}`)).join(', '),
        });
      case 'none':
        return '';
    }
  }

  /** Enregistre sur l'appareil : un changement pour les constantes, un pour l'observation. */
  async save(): Promise<void> {
    if (this.patientId === null) return;
    const { reading, invalid } = parseVitals(this.input);
    const note = this.note.trim();
    if (invalid.length > 0) {
      this.outcome = { kind: 'invalid', fields: invalid };
      return;
    }
    if (Object.keys(reading).length === 0 && note === '') {
      this.outcome = { kind: 'empty' };
      return;
    }
    const patientId = this.patientId;
    const resource = dossierResource(patientId);
    if (Object.keys(reading).length > 0) {
      await this.recorder.record(patientId, resource, 'add', 'vitals', reading);
    }
    if (note !== '') await this.recorder.record(patientId, resource, 'add', 'observations', note);
    const pending = await this.store.changes.pendingCount();
    const clock = await this.store.clocks.get(resource);
    runInAction(() => {
      this.clock = { ...clock };
      this.input = emptyVitalsInput();
      this.note = '';
      this.outcome = { kind: 'saved', pending };
    });
  }
}
