import { makeAutoObservable, runInAction } from 'mobx';
import type { CopiloteGateway } from './gateways.js';
import type { CopiloteSource, LocaleSource } from './types.js';

/** Message de l'historique de conversation. */
export interface CopiloteMessage {
  id: number;
  author: 'user' | 'assistant';
  text: string;
  sources: CopiloteSource[];
  failed?: boolean;
}

/** Conversation avec le copilote : historique, envoi d'une question, réponse et sources. */
export class CopiloteViewModel {
  messages: CopiloteMessage[] = [];
  draft = '';
  pending = false;

  private patientId: string | null = null;
  private nextId = 1;

  constructor(
    private readonly gateway: CopiloteGateway,
    private readonly i18n: LocaleSource,
  ) {
    makeAutoObservable<CopiloteViewModel, 'gateway' | 'i18n' | 'patientId' | 'nextId'>(
      this,
      { gateway: false, i18n: false, patientId: false, nextId: false },
      { autoBind: true },
    );
  }

  /** Ouvre la conversation d'un patient (efface l'historique si le patient change). */
  open(patientId: string): void {
    if (this.patientId !== patientId) this.messages = [];
    this.patientId = patientId;
  }

  setDraft(text: string): void {
    this.draft = text;
  }

  get canSend(): boolean {
    return this.patientId !== null && !this.pending && this.draft.trim() !== '';
  }

  /** Envoie le brouillon courant au copilote. */
  async send(): Promise<void> {
    const patientId = this.patientId;
    const question = this.draft.trim();
    if (!this.canSend || patientId === null) return;
    this.push('user', question, []);
    this.draft = '';
    this.pending = true;
    try {
      const answer = await this.gateway.ask(patientId, question);
      runInAction(() => this.push('assistant', answer.answer, answer.sources));
    } catch {
      runInAction(() => this.push('assistant', this.i18n.t('error.generic'), [], true));
    } finally {
      runInAction(() => {
        this.pending = false;
      });
    }
  }

  /** Libellés traduits. */
  get labels(): { title: string; placeholder: string; send: string; sources: string } {
    const { t } = this.i18n;
    return {
      title: t('copilot.title'),
      placeholder: t('copilot.placeholder'),
      send: t('copilot.send'),
      sources: t('copilot.sources'),
    };
  }

  /** Nom affiché de l'auteur d'un message. */
  authorLabel(message: CopiloteMessage): string {
    return this.i18n.t(message.author === 'user' ? 'copilot.you' : 'copilot.assistant');
  }

  private push(
    author: CopiloteMessage['author'],
    text: string,
    sources: CopiloteSource[],
    failed = false,
  ): void {
    this.messages.push({ id: this.nextId++, author, text, sources, failed });
  }
}
