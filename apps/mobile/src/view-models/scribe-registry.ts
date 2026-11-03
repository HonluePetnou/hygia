import {
  ScribeViewModel,
  type AudioRecorder,
  type LocaleSource,
  type ScribeGateway,
} from '@hygia/view-models';

/**
 * Une vue-modèle de scribe par patient : changer d'onglet ne perd ni l'enregistrement en cours
 * ni le brouillon à valider.
 */
export class ScribeRegistry {
  private readonly models = new Map<string, ScribeViewModel>();

  constructor(
    private readonly gateway: ScribeGateway,
    private readonly createRecorder: () => AudioRecorder,
    private readonly i18n: LocaleSource,
  ) {}

  /** Vue-modèle du patient (créée à la première demande). */
  forPatient(patientId: string): ScribeViewModel {
    let model = this.models.get(patientId);
    if (model === undefined) {
      model = new ScribeViewModel(patientId, this.gateway, this.createRecorder(), this.i18n);
      this.models.set(patientId, model);
    }
    return model;
  }
}
