import type { Filter } from './filter.js';

/** Événement émis par étape. */
export interface StageEvent {
  stage: string;
  status: 'started' | 'done' | 'failed';
  durationMs?: number;
  error?: string;
}

/** Document en échec, conservé en file de lettres mortes. */
export interface DeadLetter {
  stage: string;
  error: string;
  input: unknown;
}

/** Résultat d'une exécution. */
export type PipelineResult<Out> =
  | { status: 'ok'; output: Out }
  | { status: 'skipped'; output: unknown }
  | { status: 'failed'; deadLetter: DeadLetter };

/** File de lettres mortes en mémoire. */
export class DeadLetterQueue {
  readonly items: DeadLetter[] = [];

  push(letter: DeadLetter): void {
    this.items.push(letter);
  }
}

/** Chaîne de filtres : événements par étape, échec vers les lettres mortes. */
export class Pipeline<In, Out> {
  private constructor(
    private readonly filters: readonly Filter<unknown, unknown>[],
    private readonly deadLetters: DeadLetterQueue,
    private readonly onEvent: (event: StageEvent) => void,
    private readonly shouldStop: (value: unknown) => boolean,
  ) {}

  /** Crée une chaîne vide. `shouldStop` interrompt le traitement (ex. doublon). */
  static create<T>(
    deadLetters: DeadLetterQueue,
    onEvent: (event: StageEvent) => void = () => undefined,
    shouldStop: (value: unknown) => boolean = () => false,
  ): Pipeline<T, T> {
    return new Pipeline<T, T>([], deadLetters, onEvent, shouldStop);
  }

  /** Ajoute un filtre en fin de chaîne. */
  then<Next>(filter: Filter<Out, Next>): Pipeline<In, Next> {
    return new Pipeline<In, Next>(
      [...this.filters, filter as Filter<unknown, unknown>],
      this.deadLetters,
      this.onEvent,
      this.shouldStop,
    );
  }

  /** Exécute la chaîne sur un document. */
  async run(input: In): Promise<PipelineResult<Out>> {
    let value: unknown = input;
    for (const filter of this.filters) {
      const start = performance.now();
      this.onEvent({ stage: filter.name, status: 'started' });
      try {
        value = await filter.process(value);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        const durationMs = performance.now() - start;
        this.onEvent({ stage: filter.name, status: 'failed', durationMs, error });
        const deadLetter = { stage: filter.name, error, input: value };
        this.deadLetters.push(deadLetter);
        return { status: 'failed', deadLetter };
      }
      this.onEvent({ stage: filter.name, status: 'done', durationMs: performance.now() - start });
      if (this.shouldStop(value)) return { status: 'skipped', output: value };
    }
    return { status: 'ok', output: value as Out };
  }
}
