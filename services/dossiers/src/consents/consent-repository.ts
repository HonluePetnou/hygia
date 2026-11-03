import { randomUUID } from 'node:crypto';
import type { Language } from '@hygia/types';
import { CONSENT_PURPOSES, DEFAULT_GRANTED, type Consent, type ConsentPurpose } from './consent.js';

/** Jeton d'injection du dépôt des consentements. */
export const CONSENT_REPOSITORY = Symbol('CONSENT_REPOSITORY');

/** Dépôt des consentements et des préférences des patients (service Dossiers). */
export interface ConsentRepository {
  /** Consentement courant ; les valeurs par défaut sont créées à la première lecture. */
  get(patientId: string, purpose: ConsentPurpose, now: Date): Consent;
  save(consent: Consent): void;
  languageOf(patientId: string): Language;
  setLanguage(patientId: string, language: Language): void;
}

/** Dépôt en mémoire (remplaçable par Prisma). */
export class InMemoryConsentRepository implements ConsentRepository {
  private readonly consents = new Map<string, Consent>();
  private readonly languages = new Map<string, Language>();

  get(patientId: string, purpose: ConsentPurpose, now: Date): Consent {
    const key = `${patientId}:${purpose}`;
    let consent = this.consents.get(key);
    if (consent === undefined) {
      const granted = DEFAULT_GRANTED[purpose];
      consent = {
        id: randomUUID(),
        version: 1,
        patientId,
        purpose,
        granted,
        ...(granted ? { grantedAt: now.toISOString() } : {}),
      };
      this.consents.set(key, consent);
    }
    return { ...consent };
  }

  save(consent: Consent): void {
    this.consents.set(`${consent.patientId}:${consent.purpose}`, { ...consent });
  }

  languageOf(patientId: string): Language {
    return this.languages.get(patientId) ?? 'fr';
  }

  setLanguage(patientId: string, language: Language): void {
    this.languages.set(patientId, language);
  }
}

/** Toutes les finalités d'un patient, dans l'ordre de l'écran. */
export function allConsents(
  repository: ConsentRepository,
  patientId: string,
  now: Date,
): Consent[] {
  return CONSENT_PURPOSES.map((purpose) => repository.get(patientId, purpose, now));
}
