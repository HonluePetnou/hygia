import { FLORENCE_ID } from '@hygia/fhir';
import { createTranslator } from '@hygia/i18n';
import { describe, expect, it } from 'vitest';
import {
  HttpScribeGateway,
  InMemoryScribeGateway,
  ScribeViewModel,
  formatDuration,
  type AudioRecorder,
  type ScribeGateway,
} from '../src/index.js';

class FakeRecorder implements AudioRecorder {
  started = false;
  failing = false;
  async start(): Promise<void> {
    if (this.failing) throw new Error('micro');
    this.started = true;
  }
  async stop() {
    return { base64: 'YXVkaW8=', durationSeconds: 277 };
  }
  level(): number {
    return 0.5;
  }
}

function build(gateway: ScribeGateway = new InMemoryScribeGateway()) {
  const recorder = new FakeRecorder();
  let now = 0;
  const vm = new ScribeViewModel(
    FLORENCE_ID,
    gateway,
    recorder,
    { locale: 'fr', t: createTranslator('fr') },
    () => now,
  );
  return { vm, recorder, advance: (ms: number) => (now += ms) };
}

describe('ScribeViewModel', () => {
  it('enregistre avec onde et durée, puis présente le brouillon « À valider »', async () => {
    const { vm, advance } = build();
    await vm.start();
    expect(vm.state).toBe('recording');
    advance(277_000);
    vm.tick();
    expect(vm.durationLabel).toBe('04:37');
    expect(vm.level).toBe(0.5);
    await vm.stop();
    expect(vm.state).toBe('draft');
    expect(vm.sections.map((s) => s.title)).toEqual(['Motif', 'Examen', 'Diagnostic', 'Prescription']);
    expect(vm.sections[2]?.lines).toEqual(['I10 · Hypertension essentielle']);
    expect(vm.sections[3]?.lines).toEqual(['Amlodipine 10 mg 1×/j · contrôle dans 4 semaines']);
  });

  it('valide le brouillon corrigé', async () => {
    const gateway = new InMemoryScribeGateway();
    const { vm } = build(gateway);
    await vm.start();
    await vm.stop();
    vm.toggleEditing();
    vm.setText('motif', 'Motif corrigé');
    await vm.validate();
    expect(vm.state).toBe('validated');
    expect(vm.outcomeMessage).toContain('Audio supprimé');
    expect(vm.editing).toBe(false);
  });

  it('le rejet ne garde rien', async () => {
    const { vm } = build();
    await vm.start();
    await vm.stop();
    await vm.reject();
    expect(vm.state).toBe('rejected');
    expect(vm.draft).toBeNull();
    expect(vm.sections).toEqual([]);
    vm.reset();
    expect(vm.state).toBe('idle');
  });

  it('explique le refus de consentement et n’ouvre pas le micro', async () => {
    const gateway = new InMemoryScribeGateway();
    gateway.refused.add(FLORENCE_ID);
    const { vm, recorder } = build(gateway);
    await vm.start();
    expect(vm.state).toBe('idle');
    expect(recorder.started).toBe(false);
    expect(vm.errorMessage).toContain('n’a pas consenti');
  });

  it('signale un micro indisponible', async () => {
    const { vm, recorder } = build();
    recorder.failing = true;
    await vm.start();
    expect(vm.state).toBe('idle');
    expect(vm.errorMessage).toBe('Microphone indisponible.');
  });

  it('formate les durées', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(3725)).toBe('62:05');
  });

  it('la passerelle HTTP appelle les routes du scribe avec le jeton', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fetchFn = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: 's1', status: 'recording' }), { status: 200 });
    }) as unknown as typeof fetch;
    const gateway = new HttpScribeGateway(
      'http://broker/api/ia-clinique',
      () => ({ userId: 'u', role: 'medecin', token: 'jeton' }),
      fetchFn,
    );
    await gateway.start('p1');
    await gateway.sendAudio('s1', 'QQ==', 12);
    await gateway.reject('s1');
    expect(calls.map((c) => c.url)).toEqual([
      'http://broker/api/ia-clinique/scribe/patients/p1/sessions',
      'http://broker/api/ia-clinique/scribe/sessions/s1/audio',
      'http://broker/api/ia-clinique/scribe/sessions/s1/rejet',
    ]);
    expect((calls[0]?.init?.headers as Record<string, string>)['authorization']).toBe('Bearer jeton');
  });
});
