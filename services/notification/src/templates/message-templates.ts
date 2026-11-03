import { createTranslator, formatDateTime, type Locale } from '@hygia/i18n';

/** Modèles de messages patient FR/EN (textes dans `@hygia/i18n`, clés `notif.*`). */
export class MessageTemplates {
  /** Rappel de rendez-vous avec les réponses « 1 » / « 2 ». */
  reminder(locale: Locale, startsAt: string): string {
    return createTranslator(locale)('notif.reminder', { date: formatDateTime(startsAt, locale) });
  }

  /** Confirmation après la réponse « 1 ». */
  confirmed(locale: Locale, startsAt: string): string {
    return createTranslator(locale)('notif.confirmed', { date: formatDateTime(startsAt, locale) });
  }

  /** Accusé de la demande de report (« 2 »). */
  postponed(locale: Locale, startsAt: string): string {
    return createTranslator(locale)('notif.postponed', { date: formatDateTime(startsAt, locale) });
  }

  /** Réponse à un texte non reconnu. */
  unknownReply(locale: Locale): string {
    return createTranslator(locale)('notif.unknownReply');
  }

  /** « Document reçu » après une photo d'ordonnance. */
  documentReceived(locale: Locale): string {
    return createTranslator(locale)('notif.documentReceived');
  }

  /** Photo refusée (format ou patient inconnu). */
  documentRejected(locale: Locale): string {
    return createTranslator(locale)('notif.documentRejected');
  }

  /** Message du médecin (validé) transmis au patient. */
  clinicianMessage(locale: Locale, text: string): string {
    return createTranslator(locale)('notif.clinicianMessage', { text });
  }
}
