import type { PatientSearchGateway, PatientSummary } from '@hygia/view-models';
import type { PatientStore } from './patient-store.js';

/**
 * Dépôt des patients adossé à la base SQLite de l'appareil : même contrat que le dépôt HTTP du
 * web (`PatientSearchGateway`), donc même vue-modèle, donnée locale plutôt que distante.
 */
export class LocalPatientsGateway implements PatientSearchGateway {
  constructor(private readonly patients: PatientStore) {}

  /** Dossiers locaux dont le nom ou l'IPP contient la requête (vide : tous). */
  search(query: string): Promise<PatientSummary[]> {
    return this.patients.search(query);
  }
}
