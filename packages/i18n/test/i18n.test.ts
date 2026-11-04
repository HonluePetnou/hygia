import { describe, expect, it } from 'vitest';
import {
  DISPLAY_TIME_ZONE,
  createTranslator,
  en,
  formatDate,
  formatDateTime,
  fr,
  localParts,
} from '../src/index.js';

const normalize = (s: string): string => s.replace(/[  ]/g, ' ');

describe('heure affichée (Cameroun, UTC+1)', () => {
  it('découpe un horodatage UTC en heure locale du Cameroun', () => {
    expect(DISPLAY_TIME_ZONE).toBe('Africa/Douala');
    expect(localParts('2026-11-04T23:30:05Z')).toEqual({
      year: 2026,
      month: 11,
      day: 5,
      hours: 0,
      minutes: 30,
      seconds: 5,
    });
  });
});

describe('accords au pluriel', () => {
  it('français : 0 et 1 au singulier, 2 et plus au pluriel', () => {
    const t = createTranslator('fr');
    expect(t('dashboard.subtitle', { consultations: 1, alerts: 1 })).toBe(
      '1 consultation prévue · 1 alerte IA à examiner',
    );
    expect(t('dashboard.subtitle', { consultations: 3, alerts: 4 })).toBe(
      '3 consultations prévues · 4 alertes IA à examiner',
    );
    expect(t('copilot.passagesFound', { count: 1 })).toBe('1 passage retrouvé');
    expect(t('copilot.passagesFound', { count: 0 })).toBe('0 passage retrouvé');
    expect(t('epidemiology.map.summary', { cases: 14, regions: 1 })).toBe(
      '14 cas notifiés · 1 région',
    );
    expect(t('audit.indicator.events.note', { total: 1 })).toBe('1 entrée au total');
  });

  it('anglais : seul 1 est au singulier', () => {
    const t = createTranslator('en');
    expect(t('copilot.passagesFound', { count: 1 })).toMatch(/^1 passage\b(?!s)/);
    expect(t('copilot.passagesFound', { count: 0 })).toMatch(/^0 passages/);
    expect(t('epidemiology.map.summary', { cases: 1, regions: 2 })).toMatch(/1 case\b.*2 regions/);
  });

  it('forme absente si le paramètre manque', () => {
    expect(createTranslator('fr')('copilot.passagesFound')).toBe('{count} {count:passage retrouvé|passages retrouvés}');
  });
});

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
