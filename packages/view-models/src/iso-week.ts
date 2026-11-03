const DAY = 86_400_000;

/** Lundi (UTC) de la semaine ISO `AAAA-Wnn`. */
function mondayOf(label: string): Date {
  const match = /^(\d{4})-W(\d{2})$/.exec(label);
  if (!match) throw new Error(`semaine invalide : ${label}`);
  const jan4 = new Date(Date.UTC(Number(match[1]), 0, 4));
  const monday = jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAY;
  return new Date(monday + (Number(match[2]) - 1) * 7 * DAY);
}

/** Étiquette ISO d'une date (UTC). */
function labelOf(date: Date): string {
  const thursday = new Date(date.getTime() + (3 - ((date.getUTCDay() + 6) % 7)) * DAY);
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / (7 * DAY)) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Décale une semaine ISO de `delta` semaines (négatif : vers le passé). */
export function shiftWeek(label: string, delta: number): string {
  return labelOf(new Date(mondayOf(label).getTime() + delta * 7 * DAY));
}

/** Numéro de semaine d'une étiquette (`2026-W44` → 44). */
export function weekNumber(label: string): number {
  return Number(label.slice(label.indexOf('W') + 1));
}
