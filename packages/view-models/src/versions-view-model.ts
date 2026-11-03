import { formatDateTime } from '@hygia/i18n';
import { makeAutoObservable, runInAction } from 'mobx';
import type { PatientsGateway } from './gateways.js';
import { GatewayError } from './http-client.js';
import type { LoadState } from './load-state.js';
import type { LocaleSource, ResourceVersion } from './types.js';

/** Version prête à afficher dans la liste. */
export interface VersionRow {
  key: string;
  typeLabel: string;
  title: string;
  number: number;
  numberLabel: string;
  authorLabel: string;
  dateLabel: string;
  reason: string;
  selected: boolean;
}

/** Ligne de la comparaison : un champ, sa valeur dans chaque version, surligné s'il a changé. */
export interface ComparisonRow {
  field: string;
  label: string;
  left: string;
  right: string;
  changed: boolean;
}

/** Deux versions de la même ressource, de la plus ancienne (gauche) à la plus récente (droite). */
export interface Comparison {
  leftLabel: string;
  rightLabel: string;
  rows: ComparisonRow[];
}

/** Champs techniques non affichés dans la comparaison. */
const HIDDEN_FIELDS = new Set(['id', 'resourceType', 'subject']);

const keyOf = (version: ResourceVersion): string => `${version.resourceId}@${version.number}`;

function display(value: unknown): string {
  if (value === undefined || value === null) return '—';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** Onglet « Versions » : historique du dossier et comparaison côte à côte de deux versions. */
export class VersionsViewModel {
  state: LoadState = 'idle';
  versions: ResourceVersion[] = [];
  /** Clés (`ressource@numéro`) des versions cochées, au plus deux, toutes de la même ressource. */
  selectedKeys: string[] = [];

  private patientId: string | null = null;

  constructor(
    private readonly gateway: PatientsGateway,
    private readonly i18n: LocaleSource,
  ) {
    makeAutoObservable<VersionsViewModel, 'gateway' | 'i18n' | 'patientId'>(
      this,
      { gateway: false, i18n: false, patientId: false },
      { autoBind: true },
    );
  }

  /** Charge l'historique du dossier (la lecture est auditée côté service). */
  async load(patientId: string): Promise<void> {
    this.patientId = patientId;
    this.state = 'loading';
    this.selectedKeys = [];
    try {
      const versions = await this.gateway.versions(patientId);
      if (this.patientId !== patientId) return;
      runInAction(() => {
        this.versions = versions;
        this.state = 'ready';
      });
    } catch (error) {
      if (this.patientId !== patientId) return;
      runInAction(() => {
        this.state = error instanceof GatewayError && error.status === 403 ? 'forbidden' : 'error';
      });
    }
  }

  /** Coche ou décoche une version ; la sélection reste limitée à deux versions d'une même ressource. */
  toggle(key: string): void {
    if (this.selectedKeys.includes(key)) {
      this.selectedKeys = this.selectedKeys.filter((selected) => selected !== key);
      return;
    }
    const resourceOf = (k: string): string => k.split('@')[0] ?? '';
    const sameResource = this.selectedKeys.filter((k) => resourceOf(k) === resourceOf(key));
    this.selectedKeys = [...sameResource.slice(-1), key];
  }

  /** Versions du dossier, prêtes à afficher. */
  get rows(): VersionRow[] {
    const { t, locale } = this.i18n;
    return this.versions.map((version) => ({
      key: keyOf(version),
      typeLabel: t(`versions.type.${version.resourceType}`),
      title: this.titleOf(version),
      number: version.number,
      numberLabel: t('versions.number', { n: version.number }),
      authorLabel: version.author === 'système' ? t('versions.system') : version.author,
      dateLabel: formatDateTime(version.createdAt, locale),
      reason: version.reason,
      selected: this.selectedKeys.includes(keyOf(version)),
    }));
  }

  /** Comparaison des deux versions cochées, ou `null` tant qu'il n'y en a pas deux. */
  get comparison(): Comparison | null {
    if (this.selectedKeys.length !== 2) return null;
    const picked = this.versions
      .filter((version) => this.selectedKeys.includes(keyOf(version)))
      .sort((a, b) => a.number - b.number);
    const [left, right] = picked;
    if (!left || !right) return null;
    const fields = [...new Set([...Object.keys(left.content), ...Object.keys(right.content)])].filter(
      (field) => !HIDDEN_FIELDS.has(field),
    );
    const { t } = this.i18n;
    return {
      leftLabel: t('versions.number', { n: left.number }),
      rightLabel: t('versions.number', { n: right.number }),
      rows: fields.map((field) => {
        const label = t(`versions.field.${field}`);
        return {
          field,
          label: label === `versions.field.${field}` ? field : label,
          left: display(left.content[field]),
          right: display(right.content[field]),
          changed: display(left.content[field]) !== display(right.content[field]),
        };
      }),
    };
  }

  get emptyMessage(): string | null {
    return this.state === 'ready' && this.versions.length === 0 ? this.i18n.t('versions.empty') : null;
  }

  get errorMessage(): string | null {
    return this.state === 'error' || this.state === 'forbidden' ? this.i18n.t('error.generic') : null;
  }

  private titleOf(version: ResourceVersion): string {
    if (version.resourceType === 'Patient') return this.i18n.t('versions.type.Patient');
    return display(version.content['title']);
  }
}
