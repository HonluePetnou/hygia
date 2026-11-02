import type { Locale } from './translator.js';

const intlLocale: Record<Locale, string> = { fr: 'fr-FR', en: 'en-US' };

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
