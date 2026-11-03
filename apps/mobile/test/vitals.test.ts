import { describe, expect, it } from 'vitest';
import { emptyVitalsInput, isAbnormal, parseVitals } from '../src/offline/vitals';

describe('constantes', () => {
  it('lit la tension « 98/62 » et les nombres à virgule', () => {
    const { reading, invalid } = parseVitals({
      ...emptyVitalsInput(),
      bp: '98/62',
      temperature: '37,9',
      spo2: '96',
    });
    expect(invalid).toEqual([]);
    expect(reading).toEqual({ bp: { systolic: 98, diastolic: 62 }, temperature: 37.9, spo2: 96 });
  });

  it('signale les champs illisibles sans rien deviner', () => {
    const { invalid } = parseVitals({ ...emptyVitalsInput(), bp: '98', pulse: 'abc', weight: '-3' });
    expect(invalid).toEqual(['bp', 'pulse', 'weight']);
  });

  it('marque en anormal la maquette 16 : 98/62, 112 bpm, 9 selles ; pas 37,9 °C ni 96 %', () => {
    const { reading } = parseVitals({
      bp: '98/62',
      pulse: '112',
      temperature: '37,9',
      spo2: '96',
      weight: '58',
      stools: '9',
    });
    expect(isAbnormal('bp', reading)).toBe(true);
    expect(isAbnormal('pulse', reading)).toBe(true);
    expect(isAbnormal('stools', reading)).toBe(true);
    expect(isAbnormal('spo2', reading)).toBe(false);
    expect(isAbnormal('temperature', reading)).toBe(false);
    expect(isAbnormal('weight', reading)).toBe(false);
  });

  it('une constante absente n’est jamais anormale', () => {
    expect(isAbnormal('pulse', {})).toBe(false);
    expect(isAbnormal('bp', {})).toBe(false);
  });
});
