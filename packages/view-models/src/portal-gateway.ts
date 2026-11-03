import type { Locale } from '@hygia/i18n';
import type { ExportDownload } from './export-download.js';
import type {
  ConsentData,
  ConsentPurpose,
  ConsentSheetData,
  NextAppointmentData,
} from './portal-types.js';

/**
 * Accès du portail patient aux services Dossiers (consentements, PDF) et Notification
 * (prochain rendez-vous), par le broker. Le journal et les demandes à la DPO passent par `AuditGateway`.
 */
export interface PortalGateway {
  /** Consentements et langue du patient. */
  consents(patientId: string): Promise<ConsentSheetData>;
  /** Accorde ou révoque une finalité (`version` : contrôle optimiste). */
  setConsent(
    patientId: string,
    purpose: ConsentPurpose,
    granted: boolean,
    version: number,
  ): Promise<ConsentData>;
  /** Enregistre la langue d'interface du patient. */
  setLanguage(patientId: string, language: Locale): Promise<void>;
  /** Prochain rendez-vous, ou `null` s'il n'y en a pas. */
  nextAppointment(): Promise<NextAppointmentData | null>;
  /** Droit d'accès : dossier complet en PDF. */
  downloadDossier(patientId: string, language: Locale): Promise<ExportDownload>;
}
