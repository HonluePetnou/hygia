import type { Locale } from '@hygia/i18n';

/** `Mardi 3 novembre · 10:00` : jour long puis heure, en UTC (horodatages du service). */
export function formatAppointment(iso: string, locale: Locale): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(date);
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`;
}

/** `28 oct. · 16:12` : date courte puis heure, en UTC. */
export function formatWhen(iso: string, locale: Locale): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(date);
  return `${day} · ${time}`;
}
