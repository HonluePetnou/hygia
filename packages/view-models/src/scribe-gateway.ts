import type { ScribeDraftData, ScribeSessionData } from './scribe-types.js';

/** Accès au scribe de consultation (service IA clinique, par le broker). */
export interface ScribeGateway {
  /** Ouvre une séance ; 403 sans consentement « enregistrement audio » du patient. */
  start(patientId: string): Promise<ScribeSessionData>;
  /** Envoie l'audio (base64) ; renvoie le brouillon structuré « à valider ». */
  sendAudio(sessionId: string, audioBase64: string, durationSeconds: number): Promise<ScribeSessionData>;
  /** Valide le brouillon (éventuellement corrigé) : crée les ressources et supprime l'audio. */
  validate(sessionId: string, draft: ScribeDraftData): Promise<ScribeSessionData>;
  /** Rejette le brouillon : rien n'est créé, l'audio est supprimé. */
  reject(sessionId: string): Promise<ScribeSessionData>;
}
