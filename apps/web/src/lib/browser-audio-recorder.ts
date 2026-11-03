import type { AudioRecorder, RecordedAudio } from '@hygia/view-models';

/** Encode des octets en base64 par blocs (évite de dépasser la pile avec `apply`). */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Capture du micro du navigateur (`MediaRecorder`) avec niveau sonore pour l'onde. */
export class BrowserAudioRecorder implements AudioRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private context: AudioContext | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.context = new AudioContext();
    this.analyser = this.context.createAnalyser();
    this.context.createMediaStreamSource(this.stream).connect(this.analyser);
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (event) => this.chunks.push(event.data);
    this.recorder.start();
    this.startedAt = Date.now();
  }

  stop(): Promise<RecordedAudio> {
    const recorder = this.recorder;
    if (recorder === null) return Promise.reject(new Error('Enregistrement non démarré'));
    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        const durationSeconds = (Date.now() - this.startedAt) / 1000;
        this.release();
        new Blob(this.chunks, { type: recorder.mimeType })
          .arrayBuffer()
          .then((buffer) => resolve({ base64: toBase64(new Uint8Array(buffer)), durationSeconds }))
          .catch(reject);
      };
      recorder.stop();
    });
  }

  level(): number {
    if (this.analyser === null) return 0;
    const samples = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(samples);
    let peak = 0;
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128) / 128);
    return Math.min(1, peak * 2);
  }

  private release(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close();
    this.stream = null;
    this.context = null;
    this.analyser = null;
  }
}
