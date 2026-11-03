/** Étape indépendante et idempotente de la chaîne ; ne connaît que son entrée et sa sortie. */
export interface Filter<In, Out> {
  readonly name: string;
  process(input: In): Promise<Out>;
}

/** Tube : canal entre deux filtres. */
export interface Pipe<T> {
  send(message: T): Promise<void>;
  /** Retire le plus ancien message, ou `undefined` si le tube est vide. */
  receive(): Promise<T | undefined>;
}

/** Tube en mémoire (tests, exécution locale). */
export class InMemoryPipe<T> implements Pipe<T> {
  private readonly queue: T[] = [];

  async send(message: T): Promise<void> {
    this.queue.push(message);
  }

  async receive(): Promise<T | undefined> {
    return this.queue.shift();
  }

  /** Nombre de messages en attente. */
  get size(): number {
    return this.queue.length;
  }
}
