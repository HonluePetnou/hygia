/** Calculs de dates en UTC (`YYYY-MM-DD`), sans dépendance. */

const pad = (n: number): string => String(n).padStart(2, '0');

/** Formate une date UTC en `YYYY-MM-DD`. */
export function isoDay(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Construit une date valide (`undefined` si le jour ou le mois n'existe pas). */
export function makeDate(year: number, month: number, day: number): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? isoDay(date) : undefined;
}

/** Dernier jour du mois. */
export function endOfMonth(year: number, month: number): string {
  return isoDay(new Date(Date.UTC(year, month, 0)));
}

/** Retire `amount` jours, mois ou années à une date. */
export function subtract(today: string, amount: number, unit: 'day' | 'month' | 'year'): string {
  const [y = 0, m = 1, d = 1] = today.split('-').map(Number);
  if (unit === 'day') return isoDay(new Date(Date.UTC(y, m - 1, d - amount)));
  const months = unit === 'year' ? amount * 12 : amount;
  const target = new Date(Date.UTC(y, m - 1 - months, 1));
  const last = Number(endOfMonth(target.getUTCFullYear(), target.getUTCMonth() + 1).slice(8));
  return isoDay(
    new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, last))),
  );
}

/** Âge en années révolues à la date `today`. */
export function ageAt(birthDate: string, today: string): number {
  const [by = 0, bm = 1, bd = 1] = birthDate.slice(0, 10).split('-').map(Number);
  const [ty = 0, tm = 1, td = 1] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}
