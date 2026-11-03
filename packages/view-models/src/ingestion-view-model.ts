import { makeAutoObservable, runInAction } from 'mobx';
import type { IngestionGateway, PatientsGateway } from './gateways.js';
import { CHANNELS, STATUS_KEYS, STEP_IDS } from './ingestion-constants.js';
import type {
  ChosenFile,
  ExtractedEntityRow,
  IngestionBranches,
  IngestionStep,
  IngestionStepId,
  IngestionStepStatus,
  LocaleSource,
  PatientSummary,
} from './types.js';

/** Décision du soignant sur une entité extraite. */
export type EntityDecision = 'pending' | 'validated' | 'rejected';

/** Étape prête à afficher. */
export interface StepView {
  id: IngestionStepId;
  label: string;
  detail: string;
  status: IngestionStepStatus;
  statusLabel: string;
  durationMs: number | null;
}

/** Entité extraite avec la décision du soignant. */
export interface EntityView extends ExtractedEntityRow {
  index: number;
  kindLabel: string;
  decision: EntityDecision;
  /** Confiance faible : la ligne est mise en évidence pour relecture. */
  lowConfidence: boolean;
}

const pendingSteps = (): IngestionStep[] => STEP_IDS.map((id) => ({ id, status: 'pending' }));
const pendingBranches = (): IngestionBranches => ({ clinical: 'pending', analytic: 'pending' });

/** Import d'un document : fichier, étapes de la chaîne, branches et entités à valider. */
export class IngestionViewModel {
  file: ChosenFile | null = null;
  steps: IngestionStep[] = pendingSteps();
  branches: IngestionBranches = pendingBranches();
  entities: ExtractedEntityRow[] = [];
  decisions: EntityDecision[] = [];
  patients: PatientSummary[] = [];
  patientId = '';
  running = false;
  failed = false;
  documentId: string | null = null;

  constructor(
    private readonly gateway: IngestionGateway,
    private readonly i18n: LocaleSource,
    private readonly patientsGateway?: Pick<PatientsGateway, 'search'>,
  ) {
    makeAutoObservable<IngestionViewModel, 'gateway' | 'i18n' | 'patientsGateway'>(
      this,
      { gateway: false, i18n: false, patientsGateway: false },
      { autoBind: true },
    );
  }

  /** Charge la liste des patients proposés pour le rattachement. */
  async loadPatients(): Promise<void> {
    if (!this.patientsGateway) return;
    try {
      const found = await this.patientsGateway.search('');
      runInAction(() => {
        this.patients = found;
      });
    } catch {
      // rattachement facultatif : la liste reste vide
    }
  }

  setPatient(patientId: string): void {
    this.patientId = patientId;
  }

  chooseFile(file: ChosenFile): void {
    this.file = file;
    this.steps = pendingSteps();
    this.branches = pendingBranches();
    this.entities = [];
    this.decisions = [];
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
      const result = await this.gateway.ingest(file, this.patientId || undefined);
      runInAction(() => {
        this.steps = result.steps;
        this.branches = result.branches;
        this.entities = result.entities;
        this.decisions = result.entities.map(() => 'pending');
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

  /** Valide ou rejette une entité (rien n'est enregistré avant validation). */
  decide(index: number, decision: EntityDecision): void {
    if (index >= 0 && index < this.decisions.length) this.decisions[index] = decision;
  }

  /** Valide toutes les entités encore en attente. */
  validateAll(): void {
    this.decisions = this.decisions.map((d) => (d === 'pending' ? 'validated' : d));
  }

  get entityViews(): EntityView[] {
    return this.entities.map((entity, index) => ({
      ...entity,
      index,
      kindLabel: this.i18n.t(`import.entity.kind.${entity.kind}`),
      decision: this.decisions[index] ?? 'pending',
      lowConfidence: entity.confidence < 0.7,
    }));
  }

  get pendingCount(): number {
    return this.decisions.filter((d) => d === 'pending').length;
  }

  get channels(): Array<{ id: string; label: string; audience: string; count: number }> {
    return CHANNELS.map(({ id, count }) => ({
      id,
      count,
      label: this.i18n.t(`import.channel.${id}`),
      audience: this.i18n.t(`import.channel.${id}.audience`),
    }));
  }

  /** Statut global de la chaîne affiché en tête du panneau. */
  get chainStatus(): IngestionStepStatus {
    if (this.running) return 'inProgress';
    if (this.failed) return 'failed';
    return this.steps.every((s) => s.status === 'done') ? 'done' : 'pending';
  }

  get chainStatusLabel(): string {
    return this.i18n.t(STATUS_KEYS[this.chainStatus]);
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
      detail: this.i18n.t(`import.step.${s.id}.detail`),
      status: s.status,
      statusLabel: this.i18n.t(STATUS_KEYS[s.status]),
      durationMs: s.durationMs ?? null,
    }));
  }
}
