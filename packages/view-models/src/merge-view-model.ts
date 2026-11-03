import { makeAutoObservable, runInAction } from 'mobx';
import type { PatientsGateway } from './gateways.js';
import { GatewayError } from './http-client.js';
import type { LoadState } from './load-state.js';
import type {
  DuplicateCandidate,
  LocaleSource,
  MergeField,
  MergeOutcome,
  MergeSide,
  PatientSummary,
} from './types.js';

/** Ligne de la comparaison : une valeur par dossier, et celle qui sera gardée. */
export interface MergeRow {
  field: MergeField | 'ipp' | 'organization';
  label: string;
  a: string;
  b: string;
  differs: boolean;
  /** Le choix n'existe que pour les champs modifiables. */
  choosable: boolean;
  choice: MergeSide;
}

const CHOOSABLE: readonly MergeField[] = ['givenName', 'familyName', 'gender', 'birthDate', 'phone'];

/** Écran de comparaison côte à côte, choix champ par champ, confirmation, fusion et annulation. */
export class MergeViewModel {
  state: LoadState = 'idle';
  candidate: DuplicateCandidate | null = null;
  choices: Record<MergeField, MergeSide> = {
    givenName: 'a',
    familyName: 'a',
    gender: 'a',
    birthDate: 'a',
    phone: 'a',
  };
  reason: string;
  confirming = false;
  submitting = false;
  outcome: MergeOutcome | null = null;
  errorKey: 'error.generic' | 'merge.error.conflict' | null = null;

  constructor(
    private readonly gateway: PatientsGateway,
    private readonly i18n: LocaleSource,
  ) {
    this.reason = i18n.t('merge.reason.default');
    makeAutoObservable<MergeViewModel, 'gateway' | 'i18n'>(
      this,
      { gateway: false, i18n: false },
      { autoBind: true },
    );
  }

  /** Charge la paire de doublons ; « introuvable » si elle a été ignorée ou déjà fusionnée. */
  async load(duplicateId: string): Promise<void> {
    this.state = 'loading';
    try {
      const found = (await this.gateway.duplicates()).find((pair) => pair.id === duplicateId);
      runInAction(() => {
        this.candidate = found ?? null;
        this.state = 'ready';
      });
    } catch {
      runInAction(() => {
        this.state = 'error';
      });
    }
  }

  get percent(): number {
    return Math.round((this.candidate?.score ?? 0) * 100);
  }

  get rows(): MergeRow[] {
    if (!this.candidate) return [];
    const { a, b } = this.candidate;
    const t = this.i18n.t;
    const show = (patient: PatientSummary, field: MergeRow['field']): string => {
      if (field === 'organization') return patient.managingOrganization?.display ?? '—';
      if (field === 'gender') return patient.gender ? t(`patient.gender.${patient.gender}`) : '—';
      return patient[field] ?? '—';
    };
    const fields: MergeRow['field'][] = ['ipp', 'givenName', 'familyName', 'gender', 'birthDate', 'phone', 'organization'];
    return fields.map((field) => {
      const choosable = (CHOOSABLE as readonly string[]).includes(field);
      return {
        field,
        label: t(`merge.field.${field}`),
        a: show(a, field),
        b: show(b, field),
        differs: show(a, field) !== show(b, field),
        choosable,
        choice: choosable ? this.choices[field as MergeField] : 'a',
      };
    });
  }

  choose(field: MergeField, side: MergeSide): void {
    this.choices[field] = side;
  }

  setReason(reason: string): void {
    this.reason = reason;
  }

  requestConfirmation(): void {
    this.confirming = this.candidate !== null && this.reason.trim() !== '';
  }

  cancelConfirmation(): void {
    this.confirming = false;
  }

  /** Fusionne le dossier b dans le dossier a avec les choix faits. */
  async confirm(): Promise<void> {
    if (!this.candidate || this.submitting) return;
    const { a, b } = this.candidate;
    this.submitting = true;
    this.errorKey = null;
    try {
      const outcome = await this.gateway.mergePatients(a.id, b.id, {
        motif: this.reason.trim(),
        choix: { ...this.choices },
      });
      runInAction(() => {
        this.outcome = outcome;
        this.confirming = false;
      });
    } catch (error) {
      runInAction(() => {
        this.errorKey = error instanceof GatewayError && error.status === 409 ? 'merge.error.conflict' : 'error.generic';
        this.confirming = false;
      });
    } finally {
      runInAction(() => {
        this.submitting = false;
      });
    }
  }

  /** Annule la fusion qui vient d'être faite. */
  async undo(): Promise<void> {
    if (!this.outcome || this.outcome.undone) return;
    try {
      const outcome = await this.gateway.undoMerge(this.outcome.id);
      runInAction(() => {
        this.outcome = outcome;
      });
    } catch (error) {
      runInAction(() => {
        this.errorKey = error instanceof GatewayError && error.status === 409 ? 'merge.error.conflict' : 'error.generic';
      });
    }
  }
}
