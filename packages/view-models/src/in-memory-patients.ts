import type { Locale } from '@hygia/i18n';
import { createTranslator } from '@hygia/i18n';
import type { PatientsGateway } from './gateways.js';
import { InMemoryKnowledge, type Dataset } from './in-memory-knowledge.js';
import { buildAlerts, buildTimeline } from './in-memory-records.js';
import type {
  ConsultationSummary,
  DashboardData,
  PatientSummary,
  Resume,
  ResumeItem,
  TimelineEntry,
} from './types.js';

/** Dépôt en mémoire alimenté par les données fictives de `@hygia/fhir`. */
export class InMemoryPatientsGateway implements PatientsGateway {
  private readonly knowledge: InMemoryKnowledge;

  /**
   * @param dataset Jeu de données (en pratique `demoDataset` de `@hygia/fhir`).
   * @param today Date du jour (`YYYY-MM-DD`) pour les consultations du jour.
   */
  constructor(
    private readonly dataset: Dataset,
    private readonly today: () => string = () => new Date().toISOString().slice(0, 10),
  ) {
    this.knowledge = new InMemoryKnowledge(dataset);
  }

  dashboard(): Promise<DashboardData> {
    const today = this.today();
    const consultations: ConsultationSummary[] = this.dataset.encounters
      .filter((e) => e.start.startsWith(today))
      .map((e) => {
        const patientId = e.subject.reference.split('/')[1] ?? '';
        return { id: e.id, patientId, patientName: this.nameOf(patientId), start: e.start };
      });
    return Promise.resolve({
      consultations,
      alerts: buildAlerts(this.dataset),
      documentsImported: this.dataset.documents.length,
    });
  }

  patient(patientId: string): Promise<PatientSummary> {
    const found = this.dataset.patients.find((p) => p.id === patientId);
    if (!found) return Promise.reject(new Error(`Patient introuvable : ${patientId}`));
    const { id, ipp, familyName, givenName, birthDate } = found;
    return Promise.resolve({ id, ipp, familyName, givenName, birthDate });
  }

  timeline(patientId: string): Promise<TimelineEntry[]> {
    return Promise.resolve(buildTimeline(this.dataset, patientId));
  }

  summary(patientId: string, locale: Locale): Promise<Resume> {
    const t = createTranslator(locale);
    const item = (texte: string, term: string): ResumeItem[] => [
      { texte, sources: this.knowledge.search(patientId, term, 1) },
    ];
    const mine = <T extends { subject: { reference: string } }>(rows: readonly T[]): T[] =>
      rows.filter((r) => r.subject.reference === `Patient/${patientId}`);
    const alerts = buildAlerts(this.dataset).filter((a) => a.patientId === patientId);
    return Promise.resolve({
      patientId,
      language: locale,
      generatedByAi: true,
      titres: {
        antecedents: t('summary.history'),
        traitements: t('summary.treatments'),
        resultats: t('summary.results'),
        alertes: t('summary.alerts'),
      },
      antecedents: mine(this.dataset.conditions).flatMap((c) =>
        item(t('summary.condition', { label: c.code.display, date: c.onsetDate }), c.code.display),
      ),
      traitements: mine(this.dataset.medicationRequests).flatMap((m) =>
        item(
          t('summary.treatment', {
            label: m.medication.display,
            dose: m.dosage.doseValue,
            unit: m.dosage.doseUnit,
            times: m.dosage.timesPerDay,
            date: m.authoredOn,
          }),
          m.medication.display,
        ),
      ),
      resultats: mine(this.dataset.observations).flatMap((o) =>
        item(
          t('summary.result', {
            label: o.code.display,
            value: o.value,
            unit: o.unit,
            date: o.effectiveDate,
          }),
          o.code.display,
        ),
      ),
      alertes: alerts.flatMap((a) =>
        item(t(`summary.alert.${a.kind}`, a.params), String(Object.values(a.params)[0])),
      ),
    });
  }

  private nameOf(patientId: string): string {
    const found = this.dataset.patients.find((p) => p.id === patientId);
    return found ? `${found.givenName} ${found.familyName}` : patientId;
  }
}
