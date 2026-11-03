import type { Locale } from '@hygia/i18n';
import { GatewayError, HttpClient } from './http-client.js';
import type { PortalGateway } from './portal-gateway.js';
import type {
  ConsentData,
  ConsentPurpose,
  ConsentSheetData,
  NextAppointmentData,
} from './portal-types.js';
import type { ExportDownload } from './export-download.js';
import type { Identity } from './types.js';

/** Adresses des services du portail (derrière le broker). */
export interface PortalUrls {
  dossiersUrl: string;
  notificationUrl: string;
}

/** Passerelle HTTP du portail : Dossiers (consentements, PDF) et Notification (rendez-vous). */
export class HttpPortalGateway implements PortalGateway {
  private readonly dossiers: HttpClient;
  private readonly notification: HttpClient;

  constructor(urls: PortalUrls, identity: () => Identity, fetchFn?: typeof fetch) {
    this.dossiers = new HttpClient(urls.dossiersUrl, identity, fetchFn);
    this.notification = new HttpClient(urls.notificationUrl, identity, fetchFn);
  }

  consents(patientId: string): Promise<ConsentSheetData> {
    return this.dossiers.get(`/patients/${encodeURIComponent(patientId)}/consents`);
  }

  setConsent(
    patientId: string,
    purpose: ConsentPurpose,
    granted: boolean,
    version: number,
  ): Promise<ConsentData> {
    return this.dossiers.put(`/patients/${encodeURIComponent(patientId)}/consents/${purpose}`, {
      granted,
      version,
    });
  }

  async setLanguage(patientId: string, language: Locale): Promise<void> {
    await this.dossiers.put(`/patients/${encodeURIComponent(patientId)}/language`, { language });
  }

  async nextAppointment(): Promise<NextAppointmentData | null> {
    try {
      return await this.notification.get<NextAppointmentData>('/rendez-vous/prochain');
    } catch (error) {
      if (error instanceof GatewayError && error.status === 404) return null;
      throw error;
    }
  }

  async downloadDossier(patientId: string, language: Locale): Promise<ExportDownload> {
    const blob = await this.dossiers.postBlob(
      `/patients/${encodeURIComponent(patientId)}/export.pdf`,
      {
        langue: language,
      },
    );
    return { blob, filename: 'mon-dossier.pdf' };
  }
}
