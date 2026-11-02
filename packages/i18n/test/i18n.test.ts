import { describe, expect, it } from 'vitest';
import { createTranslator, en, formatDate, formatDateTime, fr } from '../src/index.js';

const normalize = (s: string): string => s.replace(/[  ]/g, ' ');

describe('createTranslator', () => {
  it('traduit dans les deux langues', () => {
    expect(createTranslator('fr')('nav.patients')).toBe('Patients');
    expect(createTranslator('fr')('copilot.noSource')).toBe('Aucune source ne permet de répondre');
    expect(createTranslator('en')('nav.home')).toBe('Home');
  });

  it('interpole les paramètres', () => {
    expect(createTranslator('fr')('dashboard.welcome', { nom: 'Awa' })).toBe('Bonjour Awa');
    expect(createTranslator('en')('mfa.instructions', { destination: 'a@b.c' })).toBe(
      'Enter the 6-digit code sent to a@b.c.',
    );
  });

  it('laisse le marqueur si le paramètre manque', () => {
    expect(createTranslator('fr')('dashboard.welcome')).toBe('Bonjour {nom}');
    expect(createTranslator('fr')('dashboard.welcome', {})).toBe('Bonjour {nom}');
  });

  it('renvoie la clé absente sans planter', () => {
    expect(createTranslator('fr')('inconnue.cle')).toBe('inconnue.cle');
    expect(createTranslator('en')('toString')).toBe('toString');
  });

  it('a les mêmes clés en français et en anglais', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });
});

describe('formatDate', () => {
  it('formate en français et en anglais', () => {
    expect(formatDate('2026-11-02T10:00:00Z', 'fr')).toBe('2 nov. 2026');
    expect(formatDate('2026-11-02T10:00:00Z', 'en')).toBe('Nov 2, 2026');
  });

  it('renvoie la valeur brute si la date est invalide', () => {
    expect(formatDate('pas une date', 'fr')).toBe('pas une date');
  });
});

describe('formatDateTime', () => {
  it('formate date et heure (UTC)', () => {
    expect(normalize(formatDateTime('2026-11-02T14:30:00Z', 'fr'))).toBe('2 nov. 2026, 14:30');
    expect(normalize(formatDateTime('2026-11-02T14:30:00Z', 'en'))).toBe('Nov 2, 2026, 2:30 PM');
  });
});
