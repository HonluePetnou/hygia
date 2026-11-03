import { makeAutoObservable, observable, runInAction } from 'mobx';
import { createTranslator, type Locale } from '@hygia/i18n';
import { splitAnswer, type AnswerSegment } from './answer-segments.js';
import type { CopiloteGateway, PatientsGateway } from './gateways.js';
import type { CopiloteSource, LocaleSource } from './types.js';

/** Message de l'historique de conversation. */
export interface CopiloteMessage {
  id: number;
  author: 'user' | 'assistant';
  text: string;
  sources: CopiloteSource[];
  /** Langue de la réponse (assistant uniquement, connue à la fin du flux). */
  language?: Locale;
  /** Réponse encore en cours de réception. */
  streaming?: boolean;
  failed?: boolean;
}

/** Source ouverte dans le panneau de droite. */
export interface OpenedSource {
  messageId: number;
  source: CopiloteSource;
}

const SUGGESTION_KEYS = [
  'copilot.suggestion.summary',
  'copilot.suggestion.inr',
  'copilot.suggestion.allergies',
];

/** Conversation avec le copilote : historique, réponse au fil de l'eau, sources citées. */
export class CopiloteViewModel {
  messages: CopiloteMessage[] = [];
  draft = '';
  pending = false;
  patientName: string | null = null;
  opened: OpenedSource | null = null;

  private patientId: string | null = null;
  private nextId = 1;

  constructor(
    private readonly gateway: CopiloteGateway,
    private readonly i18n: LocaleSource,
    private readonly patients?: Pick<PatientsGateway, 'patient'>,
  ) {
    makeAutoObservable<CopiloteViewModel, 'gateway' | 'i18n' | 'patients' | 'patientId' | 'nextId'>(
      this,
      // `patientId` reste observable : `canSend` en dépend.
      { gateway: false, i18n: false, patients: false, patientId: observable, nextId: false },
      { autoBind: true },
    );
  }

  /** Ouvre la conversation d'un patient (efface l'historique si le patient change). */
  open(patientId: string): void {
    if (this.patientId !== patientId) {
      this.messages = [];
      this.opened = null;
      this.patientName = null;
    }
    this.patientId = patientId;
    void this.loadPatientName(patientId);
  }

  setDraft(text: string): void {
    this.draft = text;
  }

  get canSend(): boolean {
    return this.patientId !== null && !this.pending && this.draft.trim() !== '';
  }

  /** Envoie le brouillon courant au copilote et affiche la réponse au fil de l'eau. */
  async send(): Promise<void> {
    const patientId = this.patientId;
    const question = this.draft.trim();
    if (!this.canSend || patientId === null) return;
    this.push('user', question, []);
    this.draft = '';
    this.pending = true;
    const reply = this.push('assistant', '', [], { streaming: true });
    try {
      const answer = await this.gateway.stream(patientId, question, (word) =>
        runInAction(() => {
          reply.text = reply.text === '' ? word : `${reply.text} ${word}`;
        }),
      );
      runInAction(() => {
        reply.text = answer.answer;
        reply.sources = answer.sources;
        reply.language = answer.language;
        reply.streaming = false;
      });
    } catch {
      runInAction(() => {
        reply.text = this.i18n.t('error.generic');
        reply.failed = true;
        reply.streaming = false;
      });
    } finally {
      runInAction(() => {
        this.pending = false;
      });
    }
  }

  /** Pose directement une des questions suggérées. */
  async ask(question: string): Promise<void> {
    this.setDraft(question);
    await this.send();
  }

  /** Ouvre une source citée dans le panneau de droite. */
  openSource(messageId: number, n: number): void {
    const message = this.messages.find((m) => m.id === messageId);
    const source = message?.sources.find((s) => s.n === n);
    this.opened = source ? { messageId, source } : null;
  }

  closeSource(): void {
    this.opened = null;
  }

  /** Réponse découpée en texte et marqueurs `[n]`. */
  segments(message: CopiloteMessage): AnswerSegment[] {
    return splitAnswer(message.text);
  }

  /** Badge « Répondu en … » quand la réponse n'est pas dans la langue de l'interface. */
  answeredInLabel(message: CopiloteMessage): string | null {
    if (message.author !== 'assistant' || !message.language) return null;
    if (message.language === this.i18n.locale) return null;
    return createTranslator(message.language)(`copilot.answeredIn.${message.language}`);
  }

  /** Questions suggérées, dans la langue de l'interface. */
  get suggestions(): string[] {
    return SUGGESTION_KEYS.map((key) => this.i18n.t(key));
  }

  /** Libellés traduits. */
  get labels(): {
    title: string;
    placeholder: string;
    send: string;
    sources: string;
    scope: string;
    disclaimer: string;
  } {
    const { t } = this.i18n;
    return {
      title: t('copilot.title'),
      placeholder: t('copilot.placeholder'),
      send: t('copilot.send'),
      sources: t('copilot.sources'),
      scope: this.patientName ? t('copilot.scope', { name: this.patientName }) : '',
      disclaimer: t('copilot.disclaimer'),
    };
  }

  /** Nom affiché de l'auteur d'un message. */
  authorLabel(message: CopiloteMessage): string {
    return this.i18n.t(message.author === 'user' ? 'copilot.you' : 'copilot.assistant');
  }

  private async loadPatientName(patientId: string): Promise<void> {
    if (!this.patients) return;
    try {
      const patient = await this.patients.patient(patientId);
      runInAction(() => {
        if (this.patientId === patientId) {
          this.patientName = `${patient.givenName} ${patient.familyName}`;
        }
      });
    } catch {
      // nom indisponible (ex. accès refusé) : le badge reste masqué
    }
  }

  private push(
    author: CopiloteMessage['author'],
    text: string,
    sources: CopiloteSource[],
    extra: Partial<CopiloteMessage> = {},
  ): CopiloteMessage {
    this.messages.push({ id: this.nextId++, author, text, sources, ...extra });
    // Renvoie l'objet observable stocké (et non l'original) pour que les mises à jour réagissent.
    return this.messages[this.messages.length - 1] as CopiloteMessage;
  }
}
