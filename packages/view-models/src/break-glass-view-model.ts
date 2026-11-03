import { makeAutoObservable, runInAction } from 'mobx';
import type { PatientsGateway } from './gateways.js';
import type { LocaleSource } from './types.js';

/** Motifs proposés pour un accès d'urgence. */
export type BreakGlassReason = 'vital' | 'urgent' | 'other';

const REASONS: readonly BreakGlassReason[] = ['vital', 'urgent', 'other'];

/** Fenêtre « bris de glace » : motif, précisions obligatoires, envoi du `POST`. */
export class BreakGlassViewModel {
  isOpen = false;
  reason: BreakGlassReason = 'vital';
  precisions = '';
  submitting = false;
  failed = false;

  constructor(
    private readonly gateway: PatientsGateway,
    private readonly i18n: LocaleSource,
    private readonly patientId: () => string | null,
    /** Appelé une fois l'accès accordé (recharge le dossier). */
    private readonly onGranted: () => Promise<void>,
  ) {
    makeAutoObservable<BreakGlassViewModel, 'gateway' | 'i18n' | 'patientId' | 'onGranted'>(
      this,
      { gateway: false, i18n: false, patientId: false, onGranted: false },
      { autoBind: true },
    );
  }

  open(): void {
    this.isOpen = true;
    this.failed = false;
  }

  close(): void {
    this.isOpen = false;
    this.precisions = '';
    this.reason = 'vital';
  }

  setReason(reason: BreakGlassReason): void {
    this.reason = reason;
  }

  setPrecisions(text: string): void {
    this.precisions = text;
  }

  get reasons(): { id: BreakGlassReason; label: string; selected: boolean }[] {
    return REASONS.map((id) => ({
      id,
      label: this.i18n.t(`breakGlass.reason.${id}`),
      selected: id === this.reason,
    }));
  }

  get canSubmit(): boolean {
    return !this.submitting && this.precisions.trim() !== '';
  }

  /** Envoie la demande ; en cas de succès ferme la fenêtre et recharge le dossier. */
  async submit(): Promise<void> {
    const patientId = this.patientId();
    if (patientId === null || !this.canSubmit) return;
    this.submitting = true;
    this.failed = false;
    try {
      await this.gateway.openBreakGlass(patientId, {
        motif: this.i18n.t(`breakGlass.reason.${this.reason}`),
        precisions: this.precisions.trim(),
      });
      runInAction(() => this.close());
      await this.onGranted();
    } catch {
      runInAction(() => {
        this.failed = true;
      });
    } finally {
      runInAction(() => {
        this.submitting = false;
      });
    }
  }
}
