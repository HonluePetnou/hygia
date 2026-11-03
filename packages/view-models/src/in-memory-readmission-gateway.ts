import { GatewayError } from './http-client.js';
import type { ReadmissionGateway } from './readmission-gateway.js';
import type { ReadmissionEstimate, ReadmissionFactors } from './readmission-types.js';

/** Libellé, poids (log-odds par unité) et valeur moyenne de la démonstration hors ligne. */
const WEIGHTS: Record<keyof ReadmissionFactors, [string, number, number]> = {
  age: ['Âge', 0.03, 58],
  hospitalisations: ['Hospitalisations des 12 derniers mois', 0.55, 0.8],
  traitements: ['Nombre de traitements en cours', 0.18, 4],
  insuffisanceCardiaque: ['Insuffisance cardiaque', 1.1, 0.15],
  diabete: ['Diabète', 0.5, 0.22],
};

/** Estimation locale déterministe ; `denied` simule un consentement « statistiques » révoqué. */
export class InMemoryReadmissionGateway implements ReadmissionGateway {
  constructor(private readonly denied = false) {}

  async estimate(_patientId: string, factors: ReadmissionFactors): Promise<ReadmissionEstimate> {
    if (this.denied) throw new GatewayError(403, 'consentement statistiques');
    const facteurs = (Object.keys(WEIGHTS) as (keyof ReadmissionFactors)[])
      .map((code) => {
        const [libelle, weight, mean] = WEIGHTS[code];
        return { code, libelle, contribution: Math.round(weight * (factors[code] - mean) * 1e4) / 1e4 };
      })
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    const z = -2.2 + facteurs.reduce((sum, f) => sum + f.contribution, 0);
    const score = Math.round((1 / (1 + Math.exp(-z))) * 1e4) / 1e4;
    return { score, niveau: score < 0.15 ? 'faible' : score < 0.3 ? 'modere' : 'eleve', facteurs };
  }
}
