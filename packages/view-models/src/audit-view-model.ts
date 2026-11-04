import { makeAutoObservable, runInAction } from 'mobx';
import { localParts } from '@hygia/i18n';
import type { Role } from '@hygia/types';
import type { AuditGateway } from './audit-gateway.js';
import {
  AUDIT_FILTERS,
  type AuditActionName,
  type AuditEventData,
  type AuditFilter,
  type AuditSummaryData,
} from './audit-types.js';
import type { RightsRequestData } from './portal-types.js';
import { GatewayError } from './http-client.js';
import type { LoadState } from './load-state.js';
import type { LocaleSource } from './types.js';

const ROLE_KEYS: Record<Role, string> = {
  medecin: 'role.doctor',
  infirmier: 'role.nurse',
  administratif: 'role.administrative',
  analyste: 'role.analyst',
  patient: 'role.patient',
  admin: 'role.admin',
  auditeur: 'role.auditor',
};

/** Ligne du tableau. */
export interface AuditRow {
  key: string;
  lamport: number;
  time: string;
  actor: string;
  roleLabel: string;
  action: AuditActionName;
  actionLabel: string;
  resource: string;
  reason: string;
  /** Hachage abrégé (`e51c…09a`). */
  shortHash: string;
  /** Ligne surlignée : accès par bris de glace. */
  highlighted: boolean;
}

/** Ligne du tableau des demandes des patients (vue DPO). */
export interface RightsRow {
  key: string;
  kindLabel: string;
  patientId: string;
  message: string;
  createdAt: string;
  dueAt: string;
}

/** Maillon du schéma de chaînage. */
export interface ChainLink {
  lamport: number;
  shortHash: string;
  /** Le dernier maillon est mis en avant. */
  latest: boolean;
}

/** Taille de page de l'écran. */
export const AUDIT_PAGE_SIZE = 10;

/** `e51c…09a` : début et fin du hachage. */
export function abbreviateHash(hash: string): string {
  return hash.length <= 8 ? hash : `${hash.slice(0, 4)}…${hash.slice(-3)}`;
}

/** `02/11 10:41:07` : journal horodaté en UTC, affiché à l'heure du Cameroun. */
function formatStamp(iso: string): string {
  const d = localParts(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.day)}/${p(d.month)} ${p(d.hours)}:${p(d.minutes)}:${p(d.seconds)}`;
}

/** Écran « Journal d'audit » (maquette 09) : indicateurs, chaînage, filtres, tableau paginé, export. */
export class AuditViewModel {
  state: LoadState = 'idle';
  filter: AuditFilter = 'tous';
  text = '';
  page = 1;
  total = 0;
  items: AuditEventData[] = [];
  summary: AuditSummaryData | null = null;
  /** Demandes des patients adressées à la DPO (droits, signalements). */
  rightsRequests: RightsRequestData[] = [];
  exportFailed = false;
  private token = 0;

  constructor(
    private readonly gateway: AuditGateway,
    private readonly i18n: LocaleSource,
  ) {
    makeAutoObservable<AuditViewModel, 'gateway' | 'i18n' | 'token'>(
      this,
      { gateway: false, i18n: false, token: false },
      { autoBind: true },
    );
  }

  readonly filters = AUDIT_FILTERS;

  async load(): Promise<void> {
    this.state = 'loading';
    try {
      const summary = await this.gateway.summary();
      runInAction(() => {
        this.summary = summary;
      });
      await this.reload();
      await this.loadRightsRequests();
    } catch (error) {
      this.fail(error);
    }
  }

  async setFilter(filter: AuditFilter): Promise<void> {
    this.filter = filter;
    this.page = 1;
    await this.reload();
  }

  async setText(text: string): Promise<void> {
    this.text = text;
    this.page = 1;
    await this.reload();
  }

  async goTo(page: number): Promise<void> {
    if (page < 1 || page > this.pageCount) return;
    this.page = page;
    await this.reload();
  }

  /** Télécharge le CSV des entrées filtrées ; renvoie `null` si l'export échoue. */
  async exportCsv(): Promise<string | null> {
    this.exportFailed = false;
    try {
      return await this.gateway.exportCsv({ filter: this.filter, text: this.text });
    } catch {
      runInAction(() => {
        this.exportFailed = true;
      });
      return null;
    }
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.total / AUDIT_PAGE_SIZE));
  }

  filterLabel(filter: AuditFilter): string {
    return this.i18n.t(`audit.filter.${filter}`);
  }

  /** Libellé du badge : chaîne intègre, rompue ou non vérifiée. */
  get chainLabel(): string {
    const { t } = this.i18n;
    const summary = this.summary;
    if (summary === null || summary.verifiedAt === undefined) return t('audit.chain.unknown');
    if (!summary.chainIntact) return t('audit.chain.broken', { index: summary.brokenAt ?? 0 });
    const d = localParts(summary.verifiedAt);
    const time = `${String(d.hours).padStart(2, '0')}:${String(d.minutes).padStart(2, '0')}`;
    return t('audit.chain.ok', { time });
  }

  get chainIntact(): boolean {
    return this.summary?.chainIntact ?? true;
  }

  get chain(): ChainLink[] {
    const entries = this.summary?.lastEntries ?? [];
    return entries.map((entry, i) => ({
      lamport: entry.lamport,
      shortHash: abbreviateHash(entry.hash),
      latest: i === entries.length - 1,
    }));
  }

  get rows(): AuditRow[] {
    const { t } = this.i18n;
    return this.items.map((e) => ({
      key: `${e.index}`,
      lamport: e.lamport,
      time: formatStamp(e.timestamp),
      actor: e.actor,
      roleLabel: t(ROLE_KEYS[e.role]),
      action: e.action,
      actionLabel: t(`audit.action.${e.action}`),
      resource: e.resourceId === '' ? e.resourceType : `${e.resourceType} ${e.resourceId}`,
      reason: e.reason,
      shortHash: abbreviateHash(e.hash),
      highlighted: e.action === 'bris_de_glace',
    }));
  }

  /** Demandes des patients ; une indisponibilité n'empêche pas d'afficher le journal. */
  async loadRightsRequests(): Promise<void> {
    try {
      const requests = await this.gateway.rightsRequests();
      runInAction(() => {
        this.rightsRequests = requests;
      });
    } catch {
      runInAction(() => {
        this.rightsRequests = [];
      });
    }
  }

  /** Lignes du tableau « Demandes des patients ». */
  get rightsRows(): RightsRow[] {
    const { t } = this.i18n;
    return this.rightsRequests.map((r) => ({
      key: r.id,
      kindLabel: t(`portal.rights.kind.${r.kind}`),
      patientId: r.patientId,
      message: r.message === '' ? (r.eventSummary ?? '') : r.message,
      createdAt: r.createdAt.slice(0, 10),
      dueAt: r.dueAt.slice(0, 10),
    }));
  }

  private async reload(): Promise<void> {
    const mine = ++this.token;
    try {
      const page = await this.gateway.search({
        filter: this.filter,
        text: this.text,
        page: this.page,
        pageSize: AUDIT_PAGE_SIZE,
      });
      if (mine !== this.token) return;
      runInAction(() => {
        this.items = page.items;
        this.total = page.total;
        this.state = 'ready';
      });
    } catch (error) {
      if (mine === this.token) this.fail(error);
    }
  }

  private fail(error: unknown): void {
    runInAction(() => {
      this.state = error instanceof GatewayError && error.status === 403 ? 'forbidden' : 'error';
    });
  }
}
