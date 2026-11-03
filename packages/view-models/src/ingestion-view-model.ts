import { makeAutoObservable, runInAction } from 'mobx';
import type { IngestionGateway } from './gateways.js';
import type {
  ChosenFile,
  IngestionStep,
  IngestionStepId,
  IngestionStepStatus,
  LocaleSource,
} from './types.js';

const STEP_IDS: readonly IngestionStepId[] = [
  'reception',
  'ocr',
  'normalization',
  'aiExtraction',
  'identifierDetection',
];

const STATUS_KEYS: Record<IngestionStepStatus, string> = {
  pending: 'status.pending',
  inProgress: 'status.inProgress',
  done: 'status.done',
  failed: 'status.failed',
};

/** Étape prête à afficher. */
export interface StepView {
  id: IngestionStepId;
  label: string;
  status: IngestionStepStatus;
  statusLabel: string;
  durationMs: number | null;
}

const pendingSteps = (): IngestionStep[] => STEP_IDS.map((id) => ({ id, status: 'pending' }));

/** Import d'un document : fichier choisi, étapes de la chaîne avec statut et durée. */
export class IngestionViewModel {
  file: ChosenFile | null = null;
  steps: IngestionStep[] = pendingSteps();
  running = false;
  failed = false;
  documentId: string | null = null;

  constructor(
    private readonly gateway: IngestionGateway,
    private readonly i18n: LocaleSource,
  ) {
    makeAutoObservable<IngestionViewModel, 'gateway' | 'i18n'>(
      this,
      { gateway: false, i18n: false },
      { autoBind: true },
    );
  }

  chooseFile(file: ChosenFile): void {
    this.file = file;
    this.steps = pendingSteps();
    this.failed = false;
    this.documentId = null;
  }

  get canStart(): boolean {
    return this.file !== null && !this.running;
  }

  /** Lance l'import du fichier choisi. */
  async start(): Promise<void> {
    const file = this.file;
    if (!this.canStart || file === null) return;
    this.running = true;
    this.failed = false;
    this.steps = pendingSteps().map((s, i) => (i === 0 ? { ...s, status: 'inProgress' } : s));
    try {
      const result = await this.gateway.ingest(file);
      runInAction(() => {
        this.steps = result.steps;
        this.documentId = result.documentId;
        this.failed = result.steps.some((s) => s.status === 'failed');
      });
    } catch {
      runInAction(() => {
        this.steps = this.steps.map((s) =>
          s.status === 'inProgress' ? { ...s, status: 'failed' } : s,
        );
        this.failed = true;
      });
    } finally {
      runInAction(() => {
        this.running = false;
      });
    }
  }

  get fileLabel(): string {
    return this.file ? this.file.name : this.i18n.t('import.noFile');
  }

  get title(): string {
    return this.i18n.t('import.title');
  }

  get stepViews(): StepView[] {
    return this.steps.map((s) => ({
      id: s.id,
      label: this.i18n.t(`import.step.${s.id}`),
      status: s.status,
      statusLabel: this.i18n.t(STATUS_KEYS[s.status]),
      durationMs: s.durationMs ?? null,
    }));
  }
}
