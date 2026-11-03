import type { Locale } from '@hygia/i18n';

/** Canaux de diffusion disponibles. */
export type ChannelName = 'whatsapp' | 'sms' | 'email' | 'console';

/** Destinataire (patient fictif) et ses coordonnées. */
export interface Recipient {
  patientId: string;
  /** Langue du patient : choisit le modèle de message. */
  locale: Locale;
  phone?: string;
  email?: string;
}

/** Message prêt à être envoyé. */
export interface OutboundMessage {
  recipient: Recipient;
  text: string;
  subject?: string;
}

/** Accusé d'envoi. */
export interface DeliveryReceipt {
  channel: ChannelName;
  messageId: string;
  to: string;
}

/** Canal interchangeable : WhatsApp, SMS, e-mail ou console. */
export interface ChannelSender {
  readonly channel: ChannelName;
  /** @throws Error si le destinataire n'a pas de coordonnée pour ce canal. */
  send(message: OutboundMessage): Promise<DeliveryReceipt>;
}

/** Jeton d'injection du registre des canaux. */
export const CHANNEL_SENDERS = Symbol('CHANNEL_SENDERS');
