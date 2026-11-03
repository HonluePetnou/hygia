/** Constantes saisies au lit du patient. */
export const VITAL_FIELDS = ['bp', 'pulse', 'temperature', 'spo2', 'weight', 'stools'] as const;
export type VitalField = (typeof VITAL_FIELDS)[number];

/** Texte saisi pour chaque constante (la tension se saisit « 98/62 »). */
export type VitalsInput = Record<VitalField, string>;

/** Constantes lues ; une constante non saisie est absente. */
export interface VitalsReading {
  bp?: { systolic: number; diastolic: number };
  pulse?: number;
  temperature?: number;
  spo2?: number;
  weight?: number;
  stools?: number;
}

/** Saisie vide. */
export const emptyVitalsInput = (): VitalsInput => ({
  bp: '',
  pulse: '',
  temperature: '',
  spo2: '',
  weight: '',
  stools: '',
});

const number = (text: string): number | undefined => {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) && value >= 0 ? value : undefined;
};

/** Lit une saisie : les constantes lisibles, et les champs saisis mais invalides. */
export function parseVitals(input: VitalsInput): { reading: VitalsReading; invalid: VitalField[] } {
  const reading: VitalsReading = {};
  const invalid: VitalField[] = [];
  for (const field of VITAL_FIELDS) {
    const text = input[field].trim();
    if (text === '') continue;
    if (field === 'bp') {
      const match = /^(\d{2,3})\s*\/\s*(\d{2,3})$/.exec(text);
      if (match === null) invalid.push(field);
      else reading.bp = { systolic: Number(match[1]), diastolic: Number(match[2]) };
      continue;
    }
    const value = number(text);
    if (value === undefined) invalid.push(field);
    else reading[field] = value;
  }
  return { reading, invalid };
}

/** Une constante est anormale hors de sa plage usuelle (adulte au repos), à confirmer par le soignant. */
export function isAbnormal(field: VitalField, reading: VitalsReading): boolean {
  switch (field) {
    case 'bp':
      return (
        reading.bp !== undefined &&
        (reading.bp.systolic < 100 ||
          reading.bp.systolic > 140 ||
          reading.bp.diastolic < 60 ||
          reading.bp.diastolic > 90)
      );
    case 'pulse':
      return reading.pulse !== undefined && (reading.pulse < 50 || reading.pulse > 100);
    case 'temperature':
      return reading.temperature !== undefined && (reading.temperature < 35.5 || reading.temperature > 38);
    case 'spo2':
      return reading.spo2 !== undefined && reading.spo2 < 95;
    case 'stools':
      return reading.stools !== undefined && reading.stools > 3;
    case 'weight':
      return false;
  }
}
