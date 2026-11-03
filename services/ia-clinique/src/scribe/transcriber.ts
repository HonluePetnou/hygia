/** Jeton d'injection de `Transcriber`. */
export const TRANSCRIBER = Symbol('TRANSCRIBER');

/**
 * Transcription de la parole (RF9). Implémentation simulée en local ; Amazon Transcribe en
 * français (`fr-FR`) en production.
 */
export interface Transcriber {
  /** Transcription du dialogue, une réplique par ligne préfixée « Médecin : » ou « Patient : ». */
  transcribe(audio: Uint8Array): Promise<string>;
}
