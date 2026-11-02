/** Horloge logique de Lamport (section 7.5). */
export class LamportClock {
  private counter: number;

  constructor(initial = 0) {
    this.counter = initial;
  }

  /** Valeur courante, sans la modifier. */
  get value(): number {
    return this.counter;
  }

  /** Événement local : incrémente et renvoie la nouvelle valeur. */
  tick(): number {
    this.counter += 1;
    return this.counter;
  }

  /** Réception d'une estampille distante : `max(local, distante) + 1`. */
  receive(remote: number): number {
    this.counter = Math.max(this.counter, remote) + 1;
    return this.counter;
  }
}
