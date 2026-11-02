import { describe, expect, it } from 'vitest';
import { demoDataset, FLORENCE_ID, validateResource } from '../src/index.js';

describe('demoDataset', () => {
  const all = Object.values(demoDataset).flat();

  it('a la taille attendue', () => {
    expect(demoDataset.organizations).toHaveLength(3);
    expect(demoDataset.practitioners).toHaveLength(6);
    expect(demoDataset.patients).toHaveLength(8);
    expect(demoDataset.careTeams).toHaveLength(1);
    expect(demoDataset.documents).toHaveLength(5);
  });

  it('ne contient aucun doublon d’id et que des ressources valides', () => {
    const ids = all.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const resource of all) {
      expect(validateResource(resource)).toEqual({ ok: true });
    }
  });

  it('contient Florence avec ses traitements, allergie et INR', () => {
    const florence = demoDataset.patients.find((p) => p.id === FLORENCE_ID);
    expect(florence?.ipp).toBe('HYG-2024-00871');
    expect(florence?.familyName).toBe('Ngo Bassa');
    const meds = demoDataset.medicationRequests;
    const warfarin = meds.find((m) => m.medication.display === 'Warfarine');
    expect(warfarin?.dosage).toEqual({ doseValue: 5, doseUnit: 'mg', timesPerDay: 1 });
    const ibu = meds.find((m) => m.medication.display === 'Ibuprofène');
    expect(ibu?.dosage).toEqual({ doseValue: 400, doseUnit: 'mg', timesPerDay: 3 });
    expect(ibu?.authoredOn).toBe('2026-10-28');
    expect(demoDataset.allergies[0]?.substance.display).toBe('Pénicilline');
    const inr = demoDataset.observations.find((o) => o.code.display === 'INR');
    expect(inr).toMatchObject({ value: 2.8, effectiveDate: '2026-10-14' });
  });

  it('inclut l’échographie en anglais du 2026-06-03', () => {
    const echo = demoDataset.documents.find((d) => d.language === 'en');
    expect(echo?.date).toBe('2026-06-03');
    const fevg = demoDataset.observations.find((o) => o.code.display === 'FEVG');
    expect(fevg?.value).toBe(45);
  });
});
