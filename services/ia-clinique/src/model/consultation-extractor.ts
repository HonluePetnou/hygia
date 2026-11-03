import type { Coding } from '@hygia/types';
import type {
  ConsultationDraft,
  DraftObservation,
  DraftPrescription,
} from './consultation-draft.js';

const ICD10 = 'http://hl7.org/fhir/sid/icd-10';
const ATC = 'http://www.whocc.no/atc';
const LOINC = 'http://loinc.org';

const DIAGNOSES: [RegExp, Coding][] = [
  [/hypertension/i, { system: ICD10, code: 'I10', display: 'Hypertension essentielle' }],
  [/diabète/i, { system: ICD10, code: 'E11', display: 'Diabète de type 2' }],
  [/paludisme/i, { system: ICD10, code: 'B50', display: 'Paludisme à Plasmodium falciparum' }],
  [/insuffisance cardiaque/i, { system: ICD10, code: 'I50', display: 'Insuffisance cardiaque' }],
];

const MEDICATIONS: Record<string, Coding> = {
  amlodipine: { system: ATC, code: 'C08CA01', display: 'Amlodipine' },
  paracétamol: { system: ATC, code: 'N02BE01', display: 'Paracétamol' },
  metformine: { system: ATC, code: 'A10BA02', display: 'Metformine' },
  furosémide: { system: ATC, code: 'C03CA01', display: 'Furosémide' },
};

const TIMES: Record<string, number> = { une: 1, un: 1, deux: 2, trois: 3 };
const PRESCRIPTION = new RegExp(
  `(${Object.keys(MEDICATIONS).join('|')})\\s+(?:à\\s+)?(\\d+)\\s*mg\\s+(une|un|deux|trois|\\d)\\s+fois`,
  'gi',
);

/** Texte prononcé par une personne (« Médecin : … » / « Patient : … »). */
function utterances(transcript: string, speaker: string): string[] {
  const prefix = new RegExp(`^${speaker}\\s*:\\s*`, 'i');
  return transcript
    .split('\n')
    .filter((line) => prefix.test(line.trim()))
    .map((line) => line.trim().replace(prefix, ''));
}

/**
 * Extraction à règles utilisée par le modèle simulé : repère tension, pouls, diagnostic et
 * prescriptions dans une transcription en français. Un vrai modèle (Bedrock) la remplacera.
 */
export class ConsultationExtractor {
  extract(transcript: string): ConsultationDraft {
    const doctor = utterances(transcript, 'Médecin').join(' ');
    const observations = this.observations(doctor);
    const absences = doctor
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => /^pas d['’]/i.test(sentence));
    return {
      motif: utterances(transcript, 'Patient')[0] ?? '',
      examen: [this.measuresText(observations), ...absences].filter(Boolean).join(' '),
      observations,
      diagnostics: DIAGNOSES.filter(([pattern]) => pattern.test(doctor)).map(([, coding]) => coding),
      prescriptions: this.prescriptions(doctor),
    };
  }

  private observations(text: string): DraftObservation[] {
    const found: DraftObservation[] = [];
    const pressure = /(\d{2,3})\s*(?:sur|\/)\s*(\d{2,3})/.exec(text);
    if (pressure) {
      found.push(
        { code: { system: LOINC, code: '8480-6', display: 'TA systolique' }, value: Number(pressure[1]), unit: 'mmHg' },
        { code: { system: LOINC, code: '8462-4', display: 'TA diastolique' }, value: Number(pressure[2]), unit: 'mmHg' },
      );
    }
    const pulse = /(\d{2,3})\s*(?:bpm|battements)/i.exec(text);
    if (pulse) {
      found.push({
        code: { system: LOINC, code: '8867-4', display: 'Fréquence cardiaque' },
        value: Number(pulse[1]),
        unit: 'bpm',
      });
    }
    return found;
  }

  private measuresText(observations: DraftObservation[]): string {
    const [systolic, diastolic, pulse] = [
      observations.find((o) => o.code.code === '8480-6'),
      observations.find((o) => o.code.code === '8462-4'),
      observations.find((o) => o.code.code === '8867-4'),
    ];
    const parts = [
      systolic && diastolic ? `TA ${systolic.value}/${diastolic.value} mmHg` : '',
      pulse ? `FC ${pulse.value} bpm` : '',
    ].filter(Boolean);
    return parts.length > 0 ? `${parts.join(', ')}.` : '';
  }

  private prescriptions(text: string): DraftPrescription[] {
    const follow = /contrôle dans (\d+) semaines?/i.exec(text);
    return [...text.matchAll(PRESCRIPTION)].flatMap((match) => {
      const medication = MEDICATIONS[(match[1] ?? '').toLowerCase()];
      if (!medication) return [];
      const times = match[3] ?? '1';
      return [
        {
          medication,
          doseValue: Number(match[2]),
          doseUnit: 'mg',
          timesPerDay: TIMES[times.toLowerCase()] ?? Number(times),
          ...(follow ? { note: follow[0] } : {}),
        },
      ];
    });
  }
}
