import { makeAutoObservable, runInAction } from 'mobx';
import { GatewayError } from './http-client.js';
import type { ReadmissionGateway } from './readmission-gateway.js';
import type { ReadmissionEstimate, ReadmissionFactors } from './readmission-types.js';
import type { PatientSummary, Resume, TimelineEntry, TreatmentSummary } from './types.js';

/** Éléments du dossier dont on tire les facteurs. */
export interface ReadmissionRecord {
  patient: PatientSummary;
  timeline: TimelineEntry[];
  treatments: TreatmentSummary[];
  summary: Resume | null;
}

const HEART_FAILURE = /insuffisance cardiaque|heart failure/i;
const DIABETES = /diab[eè]te|diabetes/i;
const YEAR_MS = 365.25 * 24 * 3600 * 1000;

/** Facteurs anonymes du modèle, calculés localement : le nom et la date de naissance ne partent jamais. */
export function deriveReadmissionFactors(record: ReadmissionRecord, now: Date): ReadmissionFactors {
  const born = new Date(record.patient.birthDate).getTime();
  const age = Number.isNaN(born) ? 0 : Math.max(0, Math.floor((now.getTime() - born) / YEAR_MS));
  const since = now.getTime() - YEAR_MS;
  const hospitalisations = record.timeline.filter(
    (entry) => entry.type === 'consultation' && new Date(entry.date).getTime() >= since,
  ).length;
  const texts = [
    ...record.timeline.flatMap((entry) => [entry.label, entry.detail ?? '']),
    ...(record.summary?.antecedents.map((item) => item.texte) ?? []),
  ];
  return {
    age: Math.min(age, 120),
    hospitalisations: Math.min(hospitalisations, 20),
    traitements: Math.min(record.treatments.length, 30),
    insuffisanceCardiaque: texts.some((text) => HEART_FAILURE.test(text)) ? 1 : 0,
    diabete: texts.some((text) => DIABETES.test(text)) ? 1 : 0,
  };
}

/** Carte « Risque de réadmission à 30 jours » : aide à la décision, sous consentement « statistiques ». */
export class ReadmissionViewModel {
  state: 'idle' | 'loading' | 'ready' | 'consentRevoked' | 'error' = 'idle';
  estimate: ReadmissionEstimate | null = null;

  constructor(
    private readonly gateway: ReadmissionGateway,
    private readonly now: () => Date = () => new Date(),
  ) {
    makeAutoObservable<ReadmissionViewModel, 'gateway' | 'now'>(
      this,
      { gateway: false, now: false },
      { autoBind: true },
    );
  }

  /** Les trois facteurs les plus lourds. */
  get topFactors(): ReadmissionEstimate['facteurs'] {
    return this.estimate?.facteurs.slice(0, 3) ?? [];
  }

  /** Estime le risque du patient. */
  async load(patientId: string, record: ReadmissionRecord): Promise<void> {
    this.state = 'loading';
    try {
      const result = await this.gateway.estimate(
        patientId,
        deriveReadmissionFactors(record, this.now()),
      );
      runInAction(() => {
        this.estimate = result;
        this.state = 'ready';
      });
    } catch (error) {
      runInAction(() => {
        this.estimate = null;
        this.state = error instanceof GatewayError && error.status === 403 ? 'consentRevoked' : 'error';
      });
    }
  }
}
