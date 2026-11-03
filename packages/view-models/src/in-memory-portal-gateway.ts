import type { Locale } from '@hygia/i18n';
import { FLORENCE_ID } from '@hygia/fhir';
import type { ExportDownload } from './export-download.js';
import { GatewayError } from './http-client.js';
import type { PortalGateway } from './portal-gateway.js';
import {
  CONSENT_PURPOSES,
  type ConsentData,
  type ConsentPurpose,
  type ConsentSheetData,
  type NextAppointmentData,
} from './portal-types.js';

const DEFAULTS: Record<ConsentPurpose, boolean> = {
  soins: true,
  ia: true,
  statistiques: true,
  audio: false,
  whatsapp: true,
};

/** Portail en mémoire pour la démonstration hors ligne et les tests. */
export class InMemoryPortalGateway implements PortalGateway {
  private language: Locale;
  private readonly items = new Map<ConsentPurpose, ConsentData>();

  constructor(
    language: Locale = 'fr',
    private readonly appointment: NextAppointmentData | null = {
      id: 'rdv-demo',
      startsAt: '2026-11-03T10:00:00.000Z',
      clinician: 'Dr Aïcha Nana',
      service: 'Cardiologie',
      site: 'Bonassama',
    },
    private readonly now: () => Date = () => new Date('2026-11-03T08:00:00Z'),
  ) {
    this.language = language;
    for (const purpose of CONSENT_PURPOSES) {
      this.items.set(purpose, {
        id: `consent-${purpose}`,
        version: 1,
        patientId: FLORENCE_ID,
        purpose,
        granted: DEFAULTS[purpose],
        ...(DEFAULTS[purpose] ? { grantedAt: this.now().toISOString() } : {}),
      });
    }
  }

  consents(patientId: string): Promise<ConsentSheetData> {
    return Promise.resolve({
      patientId,
      language: this.language,
      consents: CONSENT_PURPOSES.map((p) => ({ ...this.items.get(p)!, patientId })),
    });
  }

  setConsent(
    patientId: string,
    purpose: ConsentPurpose,
    granted: boolean,
    version: number,
  ): Promise<ConsentData> {
    const current = this.items.get(purpose)!;
    if (purpose === 'soins' && !granted)
      return Promise.reject(new GatewayError(400, 'consentement requis'));
    if (current.version !== version)
      return Promise.reject(new GatewayError(409, 'version périmée'));
    const at = this.now().toISOString();
    const next: ConsentData = {
      id: current.id,
      version: version + 1,
      patientId,
      purpose,
      granted,
      ...(granted
        ? { grantedAt: at }
        : { ...(current.grantedAt ? { grantedAt: current.grantedAt } : {}), revokedAt: at }),
    };
    this.items.set(purpose, next);
    return Promise.resolve(next);
  }

  setLanguage(_patientId: string, language: Locale): Promise<void> {
    this.language = language;
    return Promise.resolve();
  }

  nextAppointment(): Promise<NextAppointmentData | null> {
    return Promise.resolve(this.appointment);
  }

  downloadDossier(): Promise<ExportDownload> {
    return Promise.resolve({
      blob: new Blob(['%PDF-1.4 dossier de démonstration'], { type: 'application/pdf' }),
      filename: 'mon-dossier.pdf',
    });
  }
}
