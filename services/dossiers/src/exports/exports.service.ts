import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditLog } from '@hygia/audit';
import { createTranslator } from '@hygia/i18n';
import type { Language } from '@hygia/types';
import { AccessPolicy } from '../access/access-policy.js';
import { CLOCK, type Clock } from '../access/clock.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AUDIT_LOG } from '../patients/audit-token.js';
import { PATIENT_REPOSITORY, type PatientRepository } from '../patients/patient-repository.js';
import { buildTimeline } from '../patients/timeline.js';
import type { SearchRequest } from '../recherche/dto.js';
import { SearchService } from '../recherche/search.service.js';
import { toCsv } from './csv.js';
import { buildDossierPdf } from './dossier-pdf.js';
import { buildEpidemiologyPdf } from './epidemiology-pdf.js';
import { EPIDEMIOLOGY_SOURCE, type EpidemiologySource } from './epidemiology-source.js';

/** Fichier prêt à être téléchargé. */
export interface ExportedFile<T> {
  filename: string;
  content: T;
}

/** Exports PDF et CSV (RF17) : droits vérifiés comme pour une lecture, chaque export audité. */
@Injectable()
export class ExportsService {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repository: PatientRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(EPIDEMIOLOGY_SOURCE) private readonly epidemiology: EpidemiologySource,
    private readonly policy: AccessPolicy,
    private readonly search: SearchService,
  ) {}

  /** PDF du dossier ; 403 hors équipe de soins (sauf bris de glace actif). */
  dossierPdf(
    user: AuthenticatedUser,
    patientId: string,
    language: Language,
    summary: string[] | undefined,
  ): ExportedFile<Buffer> {
    this.policy.assertClinical(user);
    const patient = this.repository.findById(patientId);
    if (!patient) throw new NotFoundException('Patient introuvable');
    const basis = this.policy.requireAccess(user, patient.id);
    const record = this.repository.recordOf(patient.id);
    const content = buildDossierPdf({
      language,
      patient,
      organization: this.repository.organizationName(patient.managingOrganization.reference.split('/')[1] ?? ''),
      allergies: this.repository.allergiesOf(patient.id),
      treatments: record.medicationRequests,
      timeline: buildTimeline(record),
      summary,
      author: { id: user.id, role: user.role, at: this.clock.now() },
    });
    this.record(user, 'Dossier', patient.id, patient.id, basis === 'bris_de_glace' ? 'bris_de_glace' : 'soins');
    return { filename: `dossier-${patient.ipp}.pdf`, content };
  }

  /** CSV des patients correspondant à la recherche (tous résultats, limités aux dossiers lisibles). */
  searchCsv(user: AuthenticatedUser, request: SearchRequest, language: Language): ExportedFile<string> {
    const { all } = this.search.evaluate(user, request);
    const t = createTranslator(language);
    const headers = ['ipp', 'familyName', 'givenName', 'gender', 'birthDate', 'age', 'diagnoses', 'lastVisit', 'organization'].map(
      (key) => t(`export.csv.${key}`),
    );
    const rows = all.map((row) => [
      row.ipp,
      row.familyName,
      row.givenName,
      t(`patient.gender.${row.gender}`),
      row.birthDate,
      row.age,
      row.diagnoses.map((d) => d.label).join(' ; '),
      row.lastVisit,
      row.organization,
    ]);
    for (const row of all) {
      const basis = this.policy.basisFor(user, row.id);
      this.record(user, 'ListePatients', row.id, row.id, basis === 'bris_de_glace' ? 'bris_de_glace' : 'soins');
    }
    return { filename: 'patients.csv', content: toCsv(headers, rows) };
  }

  /** Rapport épidémiologique en PDF, réservé au rôle analyste ; agrégats pseudonymisés uniquement. */
  async epidemiologyPdf(
    user: AuthenticatedUser,
    language: Language,
    pathology: string | undefined,
  ): Promise<ExportedFile<Buffer>> {
    if (user.role !== 'analyste') throw new ForbiddenException('Le rapport épidémiologique est réservé au rôle analyste');
    const data = await this.epidemiology.load(pathology);
    const content = buildEpidemiologyPdf(language, data, { id: user.id, role: user.role, at: this.clock.now() });
    this.record(user, 'RapportEpidemiologique', data.week ?? 'aucune-donnee', 'aucun', 'analyse');
    return { filename: 'rapport-epidemiologique.pdf', content };
  }

  private record(user: AuthenticatedUser, type: string, resourceId: string, patientId: string, reason: string): void {
    this.audit.append({
      actor: user.id,
      role: user.role,
      action: 'export',
      resourceType: type,
      resourceId,
      patientId,
      reason,
    });
  }
}
