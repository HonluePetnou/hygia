import type { Transcriber } from './transcriber.js';

/** Consultation fictive d'hypertension (maquette 18) : toujours la même, quel que soit l'audio. */
export const MOCK_TRANSCRIPT = [
  'Médecin : Bonjour, qu’est-ce qui vous amène aujourd’hui ?',
  'Patient : Je viens renouveler mon traitement contre la tension, et j’ai des maux de tête le matin.',
  'Médecin : Je prends votre tension : 162 sur 98 millimètres de mercure, pouls à 76 battements par minute. Pas d’œdème des jambes.',
  'Médecin : C’est une hypertension essentielle, mal contrôlée. Je passe l’amlodipine à 10 mg une fois par jour au lieu de 5 mg, contrôle dans 4 semaines.',
].join('\n');

/** Transcripteur simulé : renvoie la transcription fictive si l'audio n'est pas vide. */
export class MockTranscriber implements Transcriber {
  async transcribe(audio: Uint8Array): Promise<string> {
    return audio.byteLength === 0 ? '' : MOCK_TRANSCRIPT;
  }
}
