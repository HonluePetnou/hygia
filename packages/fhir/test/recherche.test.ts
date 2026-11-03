import { describe, expect, it } from 'vitest';
import { RuleBasedQueryInterpreter, demoDataset, runSearch, type PatientFile } from '../src/index.js';

const interpreter = new RuleBasedQueryInterpreter(() => '2026-11-03');

const MOCKUP = [
  { kind: 'diagnosis', code: 'E11', label: 'Diabète de type 2' },
  { kind: 'age', comparator: 'gt', value: 60 },
  { kind: 'lastVisit', comparator: 'gte', date: '2026-01-01' },
  {
    kind: 'lab',
    test: 'hba1c',
    loinc: '4548-4',
    label: 'HbA1c',
    comparator: 'gt',
    value: 8,
    unit: '%',
  },
];

describe('interpréteur à règles', () => {
  it('comprend la requête de la maquette (4 filtres)', () => {
    const filters = interpreter.interpret(
      'patients diabétiques de plus de 60 ans vus depuis janvier avec une HbA1c > 8 %',
    );
    expect(filters).toHaveLength(4);
    expect(filters).toEqual(expect.arrayContaining(MOCKUP));
  });

  it('comprend la requête équivalente en anglais', () => {
    const filters = interpreter.interpret(
      'diabetic patients older than 60 seen since January with HbA1c above 8%',
    );
    expect(filters).toHaveLength(4);
    expect(filters).toEqual(expect.arrayContaining(MOCKUP));
  });

  it('gère comparateurs en toutes lettres, dates absolues et relatives', () => {
    expect(interpreter.interpret('INR supérieur ou égal à 3')).toEqual([
      expect.objectContaining({ kind: 'lab', test: 'inr', comparator: 'gte', value: 3 }),
    ]);
    expect(interpreter.interpret('vus avant le 15/03/2026')).toEqual([
      { kind: 'lastVisit', comparator: 'lte', date: '2026-03-15' },
    ]);
    expect(interpreter.interpret('seen since 15 March 2026')).toEqual([
      { kind: 'lastVisit', comparator: 'gte', date: '2026-03-15' },
    ]);
    expect(interpreter.interpret('vus depuis 6 mois')).toEqual([
      { kind: 'lastVisit', comparator: 'gte', date: '2026-05-03' },
    ]);
    expect(interpreter.interpret('femmes de moins de 40 ans')).toEqual([
      { kind: 'age', comparator: 'lt', value: 40 },
      { kind: 'gender', value: 'female' },
    ]);
  });

  it('transforme le reste en recherche par mot-clé', () => {
    expect(interpreter.interpret('Florence')).toEqual([{ kind: 'text', value: 'florence' }]);
    expect(interpreter.interpret('HYG-2025-01544')).toEqual([{ kind: 'text', value: 'hyg-2025-01544' }]);
    expect(interpreter.interpret('')).toEqual([]);
  });
});

describe('exécution des filtres', () => {
  const files: PatientFile[] = demoDataset.patients.map((patient) => {
    const mine = <T extends { subject: { reference: string } }>(rows: readonly T[]): T[] =>
      rows.filter((r) => r.subject.reference === `Patient/${patient.id}`);
    return {
      patient,
      conditions: mine(demoDataset.conditions),
      observations: mine(demoDataset.observations),
      encounters: mine(demoDataset.encounters),
      documents: mine(demoDataset.documents),
    };
  });

  it('retrouve la patiente cardiaque par pathologie et valeur biologique', () => {
    const filters = interpreter.interpret('insuffisance cardiaque FEVG < 50 %');
    const rows = runSearch(files, filters, '2026-11-03');
    expect(rows.map((r) => r.familyName)).toEqual(['Ngo Bassa']);
    expect(rows[0]?.diagnoses.map((d) => d.code)).toEqual(['I48', 'I50']);
    expect(rows[0]?.lastVisit).toBeDefined();
  });

  it('n’en retrouve aucune quand un filtre n’est pas vérifié', () => {
    expect(runSearch(files, interpreter.interpret('diabétiques'), '2026-11-03')).toEqual([]);
  });
});
