/** Jeton d'injection de la porte de consentement. */
export const CONSENT_GATE = Symbol('CONSENT_GATE');

/** Finalités interrogées par ce service. */
export type ConsentPurpose = 'ia' | 'audio';

/** Vérifie le consentement d'un patient auprès du service Dossiers (propriétaire de la ressource `Consent`). */
export interface ConsentGate {
  /** Vrai si le patient consent à la finalité. */
  allows(patientId: string, purpose: ConsentPurpose): Promise<boolean>;
}

/**
 * Interroge `GET /internal/consents/:patientId/:purpose` du service Dossiers.
 * Sans réponse fiable, l'IA reste bloquée : en cas de doute, on refuse (jamais d'IA sans consentement).
 */
export class HttpConsentGate implements ConsentGate {
  constructor(
    private readonly dossiersUrl: string,
    private readonly internalKey: string,
    private readonly fetchFn: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  async allows(patientId: string, purpose: ConsentPurpose): Promise<boolean> {
    try {
      const url = `${this.dossiersUrl.replace(/\/+$/, '')}/internal/consents/${encodeURIComponent(patientId)}/${purpose}`;
      const response = await this.fetchFn(url, { headers: { 'x-internal-key': this.internalKey } });
      if (!response.ok) return false;
      return ((await response.json()) as { granted?: unknown }).granted === true;
    } catch {
      return false;
    }
  }
}
