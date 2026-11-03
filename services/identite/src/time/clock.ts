/** Jeton d'injection de `Clock`. */
export const CLOCK = Symbol('CLOCK');

/** Source de temps injectable (tests déterministes). */
export interface Clock {
  now(): Date;
}

/** Horloge système. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
