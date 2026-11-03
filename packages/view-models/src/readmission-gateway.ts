import type { ReadmissionEstimate, ReadmissionFactors } from './readmission-types.js';

/** Accès à l'estimation du risque de réadmission (service Agents, par le broker). */
export interface ReadmissionGateway {
  /** Estime le risque ; 403 si le patient a révoqué le consentement « statistiques ». */
  estimate(patientId: string, factors: ReadmissionFactors): Promise<ReadmissionEstimate>;
}
