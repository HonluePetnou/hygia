import { createTranslator } from '@hygia/i18n';
import { InMemoryScribeGateway } from '@hygia/view-models';
import { describe, expect, it } from 'vitest';
import { SimulatedAudioRecorder } from '../src/runtime/simulated-audio-recorder';
import { ScribeRegistry } from '../src/view-models/scribe-registry';

describe('scribe mobile', () => {
  it('garde une vue-modèle par patient, brouillon conservé entre deux onglets', async () => {
    let now = 0;
    const registry = new ScribeRegistry(
      new InMemoryScribeGateway(),
      () => new SimulatedAudioRecorder(() => now),
      { locale: 'fr', t: createTranslator('fr') },
    );
    const vm = registry.forPatient('p1');
    expect(registry.forPatient('p1')).toBe(vm);
    expect(registry.forPatient('p2')).not.toBe(vm);
    await vm.start();
    now = 4_000;
    vm.tick();
    expect(vm.level).toBeGreaterThanOrEqual(0);
    expect(vm.level).toBeLessThanOrEqual(1);
    await vm.stop();
    expect(registry.forPatient('p1').state).toBe('draft');
    await registry.forPatient('p1').validate();
    expect(vm.state).toBe('validated');
  });
});
