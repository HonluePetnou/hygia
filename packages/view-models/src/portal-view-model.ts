import { makeAutoObservable, runInAction } from 'mobx';
import type { Locale } from '@hygia/i18n';
import type { AuditGateway } from './audit-gateway.js';
import type { AuditEventData } from './audit-types.js';
import type { ExportDownload } from './export-download.js';
import { GatewayError } from './http-client.js';
import type { LoadState } from './load-state.js';
import type { PortalGateway } from './portal-gateway.js';
import {
  CONSENT_PURPOSES,
  type ConsentData,
  type ConsentPurpose,
  type NextAppointmentData,
  type RightsKind,
} from './portal-types.js';
import { ROLE_KEYS } from './session-view-model.js';
import type { LocaleSource } from './types.js';

/** Session vue par le portail : langue modifiable et identité du patient. */
export interface PortalSession extends LocaleSource {
  readonly userId: string;
  readonly displayName: string;
  setLocale(locale: Locale): void;
}

/** Finalité obligatoire : son interrupteur est verrouillé (« Requis »). */
export const REQUIRED_CONSENT: ConsentPurpose = 'soins';

/** Entrées du journal affichées avant « Tout afficher ». */
export const PORTAL_LOG_PREVIEW = 5;
const FULL_LOG_SIZE = 100;

/** Pastille de la ligne du journal. */
export type AccessKind = 'read' | 'breakGlass' | 'agent' | 'add';

/** Ligne de « Qui a vu mon dossier ? ». */
export interface AccessRow {
  key: string;
  index: number;
  kind: AccessKind;
  initials: string;
  actor: string;
  roleLabel: string;
  /** Phrase déjà traduite (« A consulté votre dossier — motif : Soins »). */
  sentence: string;
  badge: string;
  timestamp: string;
}

const KIND_OF: Record<AuditEventData['action'], AccessKind> = {
  lecture: 'read',
  bris_de_glace: 'breakGlass',
  question_copilote: 'agent',
  alerte_ia: 'agent',
  modification: 'add',
  creation: 'add',
  import_document: 'add',
  export: 'read',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
const initialsOf = (name: string) =>
  name
    .split(/[\s.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

/** Écran « Portail patient » (maquette 13) : bandeau, journal des accès, consentements, droits. */
export class PortalViewModel {
  state: LoadState = 'idle';
  consents: ConsentData[] = [];
  appointment: NextAppointmentData | null = null;
  log: AuditEventData[] = [];
  logTotal = 0;
  showAll = false;
  /** Clé du message de confirmation ou d'erreur courant. */
  noticeKey: string | null = null;
  noticeIsError = false;

  constructor(
    private readonly portal: PortalGateway,
    private readonly audit: AuditGateway,
    private readonly session: PortalSession,
  ) {
    makeAutoObservable<PortalViewModel, 'portal' | 'audit' | 'session'>(
      this,
      { portal: false, audit: false, session: false },
      { autoBind: true },
    );
  }

  /** Charge consentements, langue du patient, prochain rendez-vous et journal des accès. */
  async load(): Promise<void> {
    this.state = 'loading';
    try {
      const [sheet, appointment, log] = await Promise.all([
        this.portal.consents(this.session.userId),
        this.portal.nextAppointment().catch(() => null),
        this.audit.search({ filter: 'tous', text: '', page: 1, pageSize: FULL_LOG_SIZE }),
      ]);
      runInAction(() => {
        // L'interface s'ouvre dans la langue enregistrée pour le patient.
        this.session.setLocale(sheet.language);
        this.consents = sheet.consents;
        this.appointment = appointment;
        this.log = log.items;
        this.logTotal = log.total;
        this.state = 'ready';
      });
    } catch (error) {
      runInAction(() => {
        this.state = error instanceof GatewayError && error.status === 403 ? 'forbidden' : 'error';
      });
    }
  }

  get firstName(): string {
    return (
      this.session.displayName
        .split(/\s+/)
        .find((w) => w.length > 1 && !/^(Dr|Mme|M\.)$/i.test(w)) ?? ''
    );
  }

  get rows(): AccessRow[] {
    const { t } = this.session;
    const events = this.showAll ? this.log : this.log.slice(0, PORTAL_LOG_PREVIEW);
    return events.map((e) => {
      const kind = KIND_OF[e.action];
      const role = t(ROLE_KEYS[e.role]);
      const actor = UUID.test(e.actor) ? role : e.actor;
      return {
        key: String(e.index),
        index: e.index,
        kind,
        initials: kind === 'agent' ? 'IA' : initialsOf(actor),
        actor,
        roleLabel: role,
        sentence: t(`portal.log.${kind}`, { reason: e.reason }),
        badge: t(`portal.badge.${kind === 'agent' ? 'add' : kind}`),
        timestamp: e.timestamp,
      };
    });
  }

  get canShowAll(): boolean {
    return !this.showAll && this.log.length > PORTAL_LOG_PREVIEW;
  }

  get purposes(): readonly ConsentPurpose[] {
    return CONSENT_PURPOSES;
  }

  consentOf(purpose: ConsentPurpose): ConsentData | undefined {
    return this.consents.find((c) => c.purpose === purpose);
  }

  toggleShowAll(): void {
    this.showAll = !this.showAll;
  }

  /** Bascule un consentement ; la version lue protège contre une modification concurrente. */
  async toggleConsent(purpose: ConsentPurpose): Promise<void> {
    const current = this.consentOf(purpose);
    if (current === undefined || purpose === REQUIRED_CONSENT) return;
    try {
      const next = await this.portal.setConsent(
        this.session.userId,
        purpose,
        !current.granted,
        current.version,
      );
      runInAction(() => {
        this.consents = this.consents.map((c) => (c.purpose === purpose ? next : c));
        this.notify('portal.notice.consentSaved', false);
      });
    } catch {
      runInAction(() => this.notify('portal.notice.error', true));
      await this.load();
    }
  }

  /** « Signaler » : transmet un accès suspect à la DPO. */
  async report(eventIndex: number): Promise<void> {
    await this.send('signalement', '', eventIndex, 'portal.notice.reported');
  }

  /** Demande de rectification ou de suppression, traitée par la DPO. */
  async request(
    kind: Exclude<RightsKind, 'signalement' | 'telechargement'>,
    message: string,
  ): Promise<void> {
    await this.send(kind, message, undefined, `portal.notice.requested.${kind}`);
  }

  /** Droit d'accès : le dossier en PDF (demande tracée pour la DPO). */
  async downloadDossier(): Promise<ExportDownload | null> {
    try {
      const file = await this.portal.downloadDossier(this.session.userId, this.session.locale);
      await this.audit.submitRightsRequest({ kind: 'telechargement', message: '' });
      return file;
    } catch {
      runInAction(() => this.notify('portal.notice.error', true));
      return null;
    }
  }

  /** Change la langue de l'interface et la mémorise pour le patient. */
  async changeLanguage(locale: Locale): Promise<void> {
    this.session.setLocale(locale);
    await this.portal.setLanguage(this.session.userId, locale).catch(() => undefined);
  }

  private async send(
    kind: RightsKind,
    message: string,
    eventIndex: number | undefined,
    successKey: string,
  ): Promise<void> {
    try {
      await this.audit.submitRightsRequest({
        kind,
        message,
        ...(eventIndex === undefined ? {} : { eventIndex }),
      });
      runInAction(() => this.notify(successKey, false));
    } catch {
      runInAction(() => this.notify('portal.notice.error', true));
    }
  }

  private notify(key: string, isError: boolean): void {
    this.noticeKey = key;
    this.noticeIsError = isError;
  }
}
