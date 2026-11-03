import { makeAutoObservable, runInAction } from 'mobx';
import type { MessageKey } from '@hygia/i18n';
import { GatewayError } from './http-client.js';
import type { ScribeGateway } from './scribe-gateway.js';
import type {
  AudioRecorder,
  ScribeDraftData,
  ScribePrescription,
  ScribeSessionData,
} from './scribe-types.js';
import type { LocaleSource } from './types.js';

/** Étapes de l'écran : rien, enregistrement, traitement, brouillon à valider, état final. */
export type ScribeState =
  | 'idle'
  | 'recording'
  | 'processing'
  | 'draft'
  | 'saving'
  | 'validated'
  | 'rejected';

/** Section du brouillon affichée (« Motif », « Examen », « Diagnostic », « Prescription »). */
export interface ScribeSection {
  key: 'motif' | 'examen' | 'diagnostic' | 'prescription';
  title: string;
  /** Une ligne par élément ; vide si le scribe n'a rien relevé. */
  lines: string[];
  /** Vrai si le médecin peut corriger le texte (motif, examen). */
  editable: boolean;
}

/** `mm:ss` à partir de secondes. */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(whole / 60))}:${pad(whole % 60)}`;
}

/**
 * Scribe de consultation d'un patient (maquette 18, RF9) : enregistrement avec l'accord du
 * patient, brouillon structuré « à valider », correction, validation ou rejet. Rien n'est écrit
 * au dossier sans la validation du médecin ; le serveur supprime l'audio ensuite.
 */
export class ScribeViewModel {
  state: ScribeState = 'idle';
  elapsedSeconds = 0;
  level = 0;
  draft: ScribeDraftData | null = null;
  editing = false;
  errorKey: MessageKey | null = null;
  private sessionId: string | null = null;
  private startedAt = 0;

  constructor(
    private readonly patientId: string,
    private readonly gateway: ScribeGateway,
    private readonly recorder: AudioRecorder,
    private readonly i18n: LocaleSource,
    private readonly clock: () => number = () => Date.now(),
  ) {
    makeAutoObservable<ScribeViewModel, 'gateway' | 'recorder' | 'i18n' | 'clock' | 'patientId'>(
      this,
      { gateway: false, recorder: false, i18n: false, clock: false, patientId: false },
      { autoBind: true },
    );
  }

  /** Durée affichée « 04:37 ». */
  get durationLabel(): string {
    return formatDuration(this.elapsedSeconds);
  }

  /** Message d'erreur traduit, vide sans erreur. */
  get errorMessage(): string {
    return this.errorKey === null ? '' : this.i18n.t(this.errorKey);
  }

  /** Message de l'état final (« Consultation enregistrée… »), vide sinon. */
  get outcomeMessage(): string {
    if (this.state === 'validated') return this.i18n.t('scribe.validated');
    if (this.state === 'rejected') return this.i18n.t('scribe.rejected');
    return '';
  }

  /** Sections du brouillon, dans l'ordre de la maquette. */
  get sections(): ScribeSection[] {
    const draft = this.draft;
    if (draft === null) return [];
    const { t } = this.i18n;
    return [
      { key: 'motif', title: t('scribe.motif'), lines: nonEmpty(draft.motif), editable: true },
      { key: 'examen', title: t('scribe.examen'), lines: nonEmpty(draft.examen), editable: true },
      {
        key: 'diagnostic',
        title: t('scribe.diagnostic'),
        lines: draft.diagnostics.map((d) => `${d.code} · ${d.display}`),
        editable: false,
      },
      {
        key: 'prescription',
        title: t('scribe.prescription'),
        lines: draft.prescriptions.map((p) => this.prescriptionLine(p)),
        editable: false,
      },
    ];
  }

  /** Ouvre la séance (vérifie le consentement) puis démarre l'enregistrement. */
  async start(): Promise<void> {
    this.errorKey = null;
    try {
      const session = await this.gateway.start(this.patientId);
      try {
        await this.recorder.start();
      } catch {
        // Micro refusé : on clôt la séance ouverte, rien n'a été enregistré.
        await this.gateway.reject(session.id).catch(() => undefined);
        runInAction(() => (this.errorKey = 'scribe.error.recorder'));
        return;
      }
      runInAction(() => {
        this.sessionId = session.id;
        this.startedAt = this.clock();
        this.elapsedSeconds = 0;
        this.state = 'recording';
      });
    } catch (error) {
      this.fail(error);
    }
  }

  /** Rafraîchit la durée et l'onde (appelé par l'interface à intervalle court). */
  tick(): void {
    if (this.state !== 'recording') return;
    this.elapsedSeconds = (this.clock() - this.startedAt) / 1000;
    this.level = this.recorder.level();
  }

  /** Arrête l'enregistrement, envoie l'audio et affiche le brouillon à valider. */
  async stop(): Promise<void> {
    if (this.state !== 'recording' || this.sessionId === null) return;
    this.state = 'processing';
    try {
      const audio = await this.recorder.stop();
      const session = await this.gateway.sendAudio(this.sessionId, audio.base64, audio.durationSeconds);
      this.showDraft(session);
    } catch (error) {
      this.fail(error);
    }
  }

  /** Active ou désactive la correction du motif et de l'examen. */
  toggleEditing(): void {
    if (this.state === 'draft') this.editing = !this.editing;
  }

  /** Corrige le texte du motif ou de l'examen. */
  setText(field: 'motif' | 'examen', value: string): void {
    if (this.draft !== null) this.draft[field] = value;
  }

  /** Valide et enregistre : crée les ressources au dossier. */
  async validate(): Promise<void> {
    if (this.state !== 'draft' || this.sessionId === null || this.draft === null) return;
    const draft = { ...this.draft };
    this.state = 'saving';
    this.editing = false;
    try {
      await this.gateway.validate(this.sessionId, draft);
      runInAction(() => (this.state = 'validated'));
    } catch (error) {
      this.fail(error, 'draft');
    }
  }

  /** Rejette le brouillon : rien n'est enregistré. */
  async reject(): Promise<void> {
    if (this.state !== 'draft' || this.sessionId === null) return;
    try {
      await this.gateway.reject(this.sessionId);
      runInAction(() => {
        this.state = 'rejected';
        this.draft = null;
        this.editing = false;
      });
    } catch (error) {
      this.fail(error, 'draft');
    }
  }

  /** Prêt pour une nouvelle consultation. */
  reset(): void {
    this.state = 'idle';
    this.draft = null;
    this.editing = false;
    this.errorKey = null;
    this.sessionId = null;
    this.elapsedSeconds = 0;
  }

  private showDraft(session: ScribeSessionData): void {
    runInAction(() => {
      this.draft = session.draft ?? null;
      this.state = session.draft ? 'draft' : 'idle';
      this.level = 0;
    });
  }

  private prescriptionLine(p: ScribePrescription): string {
    const dose = this.i18n.t('scribe.dose', {
      label: p.medication.display,
      dose: p.doseValue,
      unit: p.doseUnit,
      times: p.timesPerDay,
    });
    return p.note ? `${dose} · ${p.note}` : dose;
  }

  /** Erreur : retour à `back` (idle par défaut) avec un message précis pour le consentement. */
  private fail(error: unknown, back: ScribeState = 'idle'): void {
    runInAction(() => {
      this.state = back;
      this.level = 0;
      if (error instanceof GatewayError && error.status === 403) {
        this.errorKey = 'scribe.error.consent';
      } else if (error instanceof GatewayError && error.status === 401) {
        this.errorKey = 'scribe.error.session';
      } else {
        this.errorKey = 'scribe.error.generic';
      }
    });
  }
}

const nonEmpty = (text: string): string[] => (text.trim() === '' ? [] : [text]);
