import { RuleBasedQueryInterpreter, runSearch, type PatientFile, type SearchResponse } from '@hygia/fhir';
import type { Locale } from '@hygia/i18n';
import { createTranslator } from '@hygia/i18n';
import type { AlertDecisionKind, AlertDetailData, AlertItem, AlertTab } from './alert-types.js';
import type { PatientsGateway } from './gateways.js';
import { InMemoryAlerts } from './in-memory-alerts.js';
import { GatewayError } from './http-client.js';
import { InMemoryDuplicates, toSummary } from './in-memory-duplicates.js';
import { InMemoryKnowledge, type Dataset } from './in-memory-knowledge.js';
import {
  DEMO_WEEK_ACTIVITY,
  buildDocumentsInProgress,
  buildOverview,
  describeEntry,
} from './in-memory-overview.js';
import { buildAlerts, buildTimeline } from './in-memory-records.js';
import type {
  BreakGlassGrant,
  BreakGlassRequest,
  ConsultationSummary,
  DashboardData,
  DuplicateCandidate,
  Identity,
  MergeOutcome,
  MergeRequest,
  PatientOverview,
  PatientSummary,
  RecordSearchRequest,
  Resume,
  ResourceVersion,
  ResumeItem,
  TimelineEntry,
} from './types.js';

const BREAK_GLASS_HOURS = 4;

/** Dépôt en mémoire alimenté par les données fictives de `@hygia/fhir`. */
export class InMemoryPatientsGateway implements PatientsGateway {
  private readonly knowledge: InMemoryKnowledge;
  private readonly granted = new Set<string>();
  private readonly duplicateStore = new InMemoryDuplicates(() => this.dataset.patients);
  private readonly alertStore: InMemoryAlerts;

  /**
   * @param dataset Jeu de données (en pratique `demoDataset` de `@hygia/fhir`).
   * @param today Date du jour (`YYYY-MM-DD`) pour les consultations du jour.
   * @param identity Utilisateur courant : s'il est fourni, l'accès à un dossier est réservé
   *   à l'équipe de soins de l'établissement du patient (sinon 403) ou à un bris de glace.
   */
  constructor(
    private readonly dataset: Dataset,
    private readonly today: () => string = () => new Date().toISOString().slice(0, 10),
    private readonly identity?: () => Identity,
  ) {
    this.knowledge = new InMemoryKnowledge(dataset);
    this.alertStore = new InMemoryAlerts(dataset.patients);
  }

  dashboard(): Promise<DashboardData> {
    const today = this.today();
    const alerts = buildAlerts(this.dataset);
    const consultations: ConsultationSummary[] = this.dataset.encounters
      .filter((e) => e.start.startsWith(today))
      .map((e) => {
        const patientId = e.subject.reference.split('/')[1] ?? '';
        const flagged = alerts.some((a) => a.patientId === patientId);
        return {
          id: e.id,
          patientId,
          patientName: this.nameOf(patientId),
          start: e.start,
          reason: e.encounterClass,
          status: flagged ? 'alert' : 'done',
        };
      });
    return Promise.resolve({
      consultations,
      alerts,
      documentsImported: this.dataset.documents.length,
      documentsInProgress: buildDocumentsInProgress(this.dataset),
      resultsToValidate: this.dataset.observations.length,
      weekActivity: [...DEMO_WEEK_ACTIVITY],
    });
  }

  search(query: string): Promise<PatientSummary[]> {
    const needle = query.trim().toLowerCase();
    const found = this.dataset.patients.filter(
      (p) =>
        !this.duplicateStore.isMerged(p.id) &&
        (needle === '' ||
          p.ipp.toLowerCase().includes(needle) ||
          `${p.givenName} ${p.familyName}`.toLowerCase().includes(needle)),
    );
    return Promise.resolve(found.map(toSummary));
  }

  searchRecords(request: RecordSearchRequest): Promise<SearchResponse> {
    const today = this.today();
    const filtres =
      request.filtres ?? new RuleBasedQueryInterpreter(() => today).interpret(request.requete ?? '');
    const mine = <T extends { subject: { reference: string } }>(rows: readonly T[], id: string): T[] =>
      rows.filter((r) => r.subject.reference === `Patient/${id}`);
    const files = this.dataset.patients
      .filter((p) => !this.duplicateStore.isMerged(p.id))
      .map(
        (patient): PatientFile => ({
          patient,
          conditions: mine(this.dataset.conditions, patient.id),
          observations: mine(this.dataset.observations, patient.id),
          encounters: mine(this.dataset.encounters, patient.id),
          documents: mine(this.dataset.documents, patient.id),
        }),
      );
    const all = runSearch(files, filtres, today);
    const page = request.page ?? 1;
    const taille = request.taille ?? 10;
    const resultats = all.slice((page - 1) * taille, page * taille);
    return Promise.resolve({ filtres, resultats, total: all.length, page, taille });
  }

  /** Hors ligne : pas de moteur PDF, le fichier contient seulement un avis. */
  exportDossier(patientId: string, locale: Locale): Promise<Blob> {
    const denied = this.denial(patientId);
    if (denied) return Promise.reject(denied);
    return Promise.resolve(new Blob([`%PDF-1.4 hors ligne ${patientId} ${locale}`], { type: 'application/pdf' }));
  }

  async exportSearch(request: RecordSearchRequest, locale: Locale): Promise<Blob> {
    const t = createTranslator(locale);
    const { resultats } = await this.searchRecords({ ...request, page: 1, taille: 100 });
    const headers = ['ipp', 'familyName', 'givenName', 'birthDate'].map((key) => t(`export.csv.${key}`));
    const rows = resultats.map((r) => [r.ipp, r.familyName, r.givenName, r.birthDate].join(','));
    return new Blob([[headers.join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  }

  patient(patientId: string): Promise<PatientSummary> {
    const denied = this.denial(patientId);
    if (denied) return Promise.reject(denied);
    const found = this.dataset.patients.find((p) => p.id === patientId);
    if (!found) return Promise.reject(new GatewayError(404, `Patient introuvable : ${patientId}`));
    return Promise.resolve(toSummary(found));
  }

  overview(patientId: string): Promise<PatientOverview> {
    const denied = this.denial(patientId);
    return denied ? Promise.reject(denied) : Promise.resolve(buildOverview(this.dataset, patientId));
  }

  timeline(patientId: string): Promise<TimelineEntry[]> {
    const denied = this.denial(patientId);
    if (denied) return Promise.reject(denied);
    return Promise.resolve(
      buildTimeline(this.dataset, patientId).map((e) => describeEntry(this.dataset, e)),
    );
  }

  openBreakGlass(patientId: string, request: BreakGlassRequest): Promise<BreakGlassGrant> {
    if (request.motif.trim() === '' || request.precisions.trim() === '') {
      return Promise.reject(new GatewayError(400, 'motif et précisions obligatoires'));
    }
    this.granted.add(patientId);
    const expiresAt = new Date(Date.now() + BREAK_GLASS_HOURS * 3_600_000).toISOString();
    return Promise.resolve({ patientId, expiresAt });
  }

  /** Hors ligne : aucune modification n'est possible, donc une seule version par ressource. */
  versions(patientId: string): Promise<ResourceVersion[]> {
    const denied = this.denial(patientId);
    if (denied) return Promise.reject(denied);
    const patient = this.dataset.patients.find((p) => p.id === patientId);
    if (!patient) return Promise.reject(new GatewayError(404, `Patient introuvable : ${patientId}`));
    const documents = this.dataset.documents.filter((d) => d.subject.reference === `Patient/${patientId}`);
    const toVersion = (
      resourceType: ResourceVersion['resourceType'],
      resource: { id: string; version: number },
      createdAt: string,
    ): ResourceVersion => ({
      resourceId: resource.id,
      resourceType,
      number: resource.version,
      author: 'système',
      createdAt,
      reason: 'état initial',
      content: { ...resource },
    });
    const versions = [
      ...documents.map((d) => toVersion('DocumentReference', d, d.date)),
      toVersion('Patient', patient, `${this.today()}T00:00:00Z`),
    ];
    return Promise.resolve(versions.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  duplicates(): Promise<DuplicateCandidate[]> {
    return Promise.resolve(this.duplicateStore.list());
  }

  ignoreDuplicate(duplicateId: string): Promise<void> {
    return this.attempt(() => this.duplicateStore.ignore(duplicateId));
  }

  mergePatients(keptId: string, mergedId: string, request: MergeRequest): Promise<MergeOutcome> {
    return this.attempt(() => this.duplicateStore.merge(keptId, mergedId, request));
  }

  undoMerge(mergeId: string): Promise<MergeOutcome> {
    return this.attempt(() => this.duplicateStore.undo(mergeId));
  }

  alerts(tab?: AlertTab): Promise<AlertItem[]> {
    return this.attempt(() => this.alertStore.list(tab));
  }

  alert(alertId: string): Promise<AlertDetailData> {
    return this.attempt(() => this.alertStore.get(alertId));
  }

  decideAlert(alertId: string, decision: AlertDecisionKind, justification?: string): Promise<AlertDetailData> {
    return this.attempt(() => this.alertStore.decide(alertId, decision, justification));
  }

  private attempt<T>(action: () => T): Promise<T> {
    try {
      return Promise.resolve(action());
    } catch (error) {
      return Promise.reject(error);
    }
  }

  summary(patientId: string, locale: Locale): Promise<Resume> {
    const denied = this.denial(patientId);
    if (denied) return Promise.reject(denied);
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

  /** Erreur 403 si l'utilisateur n'est ni de l'équipe du patient ni en bris de glace. */
  private denial(patientId: string): GatewayError | null {
    if (!this.identity || this.granted.has(patientId)) return null;
    const { userId } = this.identity();
    const organization = this.dataset.patients.find((p) => p.id === patientId)
      ?.managingOrganization.reference;
    const inTeam = this.dataset.careTeams.some(
      (c) =>
        c.managingOrganization.reference === organization &&
        c.participants.some((p) => p.reference === `Practitioner/${userId}`),
    );
    return inTeam ? null : new GatewayError(403, `Accès refusé : ${patientId}`);
  }

  private nameOf(patientId: string): string {
    const found = this.dataset.patients.find((p) => p.id === patientId);
    return found ? `${found.givenName} ${found.familyName}` : patientId;
  }
}
