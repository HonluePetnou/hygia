import { HttpException } from '@nestjs/common';
import type { ConsultationDraft } from '../model/consultation-draft.js';

/** Jeton d'injection de `DossierWriter`. */
export const DOSSIER_WRITER = Symbol('DOSSIER_WRITER');

/** Écriture d'une consultation validée dans le service Dossiers, au nom du médecin. */
export interface DossierWriter {
  /**
   * Crée les ressources de la consultation et renvoie leurs identifiants.
   *
   * @param authorization En-tête `Authorization` du médecin, transmis tel quel : Dossiers refait ses contrôles.
   */
  recordConsultation(
    authorization: string,
    patientId: string,
    draft: ConsultationDraft,
  ): Promise<string[]>;
}

interface Created {
  encounter: { id: string };
  observations: { id: string }[];
  conditions: { id: string }[];
  medicationRequests: { id: string }[];
}

/** Appelle `POST /patients/:id/consultations` du service Dossiers. */
export class HttpDossierWriter implements DossierWriter {
  constructor(
    private readonly dossiersUrl: string,
    private readonly fetchFn: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  async recordConsultation(
    authorization: string,
    patientId: string,
    draft: ConsultationDraft,
  ): Promise<string[]> {
    const url = `${this.dossiersUrl.replace(/\/+$/, '')}/patients/${encodeURIComponent(patientId)}/consultations`;
    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization },
        body: JSON.stringify({
          observations: draft.observations,
          conditions: draft.diagnostics,
          // `note` (consigne de suivi) n'a pas de ressource FHIR correspondante : elle reste dans la séance.
          prescriptions: draft.prescriptions.map((p) => ({
            medication: p.medication,
            doseValue: p.doseValue,
            doseUnit: p.doseUnit,
            timesPerDay: p.timesPerDay,
          })),
        }),
      });
    } catch {
      throw new HttpException('Service Dossiers injoignable : brouillon conservé', 502);
    }
    if (!response.ok) {
      throw new HttpException(`Dossiers a refusé la consultation (${response.status})`, response.status);
    }
    const created = (await response.json()) as Created;
    return [
      created.encounter.id,
      ...created.observations.map((r) => r.id),
      ...created.conditions.map((r) => r.id),
      ...created.medicationRequests.map((r) => r.id),
    ];
  }
}
