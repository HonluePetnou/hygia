import type { AudioRecorder, RecordedAudio } from '@hygia/view-models';

/**
 * Micro simulé : onde animée et octets fictifs. L'enregistrement réel (`expo-audio`) n'est pas
 * encore branché ; il suffira d'implémenter `AudioRecorder` avec la bibliothèque et de remplacer
 * cette classe dans `runtime.ts`.
 */
export class SimulatedAudioRecorder implements AudioRecorder {
  private startedAt = 0;

  constructor(private readonly clock: () => number = () => Date.now()) {}

  async start(): Promise<void> {
    this.startedAt = this.clock();
  }

  async stop(): Promise<RecordedAudio> {
    const durationSeconds = Math.max(1, (this.clock() - this.startedAt) / 1000);
    return { base64: btoa('audio-fictif'), durationSeconds };
  }

  level(): number {
    const seconds = (this.clock() - this.startedAt) / 1000;
    return 0.5 + 0.5 * Math.sin(seconds * 6);
  }
}
