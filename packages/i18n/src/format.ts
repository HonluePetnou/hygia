import type { Locale } from './translator.js';

const intlLocale: Record<Locale, string> = { fr: 'fr-FR', en: 'en-US' };

/**
 * Fuseau d'affichage des horodatages d'événements (audit, accès) : heure du Cameroun, UTC+1,
 * sans heure d'été. Fixe, donc identique sur toutes les machines et dans les tests.
 */
export const DISPLAY_TIME_ZONE = 'Africa/Douala';

/** Composantes d'un horodatage ISO dans `DISPLAY_TIME_ZONE` (mois de 1 à 12). */
export function localParts(iso: string): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hours: get('hour'),
    minutes: get('minute'),
    seconds: get('second'),
  };
}

function format(iso: string, locale: Locale, options: Intl.DateTimeFormatOptions): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(intlLocale[locale], { timeZone: 'UTC', ...options }).format(date);
}

/** Formate une date ISO en UTC : `2 nov. 2026` (fr) ou `Nov 2, 2026` (en). */
export function formatDate(iso: string, locale: Locale): string {
  return format(iso, locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Formate une date et heure ISO en UTC : `2 nov. 2026, 14:30` (fr) ou `Nov 2, 2026, 2:30 PM` (en). */
export function formatDateTime(iso: string, locale: Locale): string {
  return format(iso, locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
