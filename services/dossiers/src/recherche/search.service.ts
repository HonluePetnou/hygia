import { Inject, Injectable } from '@nestjs/common';
import { AuditLog } from '@hygia/audit';
import {
  runSearch,
  type PatientFile,
  type QueryInterpreter,
  type SearchFilter,
  type SearchResponse,
  type SearchResultRow,
} from '@hygia/fhir';
import { AccessPolicy } from '../access/access-policy.js';
import { CLOCK, type Clock } from '../access/clock.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AUDIT_LOG } from '../patients/audit-token.js';
import { PATIENT_REPOSITORY, type PatientRepository } from '../patients/patient-repository.js';
import type { SearchRequest } from './dto.js';

/** Jeton d'injection de `QueryInterpreter` (règles aujourd'hui, modèle de langage ensuite). */
export const QUERY_INTERPRETER = Symbol('QUERY_INTERPRETER');

/** Recherche multicritère et en langage naturel (RF14), limitée aux dossiers lisibles par l'utilisateur. */
@Injectable()
export class SearchService {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repository: PatientRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    @Inject(QUERY_INTERPRETER) private readonly interpreter: QueryInterpreter,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly policy: AccessPolicy,
  ) {}

  /**
   * Interprète la requête (sauf si des filtres sont fournis), exécute la recherche et audite la
   * lecture de chaque dossier affiché (page courante).
   */
  search(user: AuthenticatedUser, request: SearchRequest): SearchResponse {
    const { filters, all } = this.evaluate(user, request);
    const start = (request.page - 1) * request.size;
    const resultats = all.slice(start, start + request.size);
    for (const row of resultats) {
      this.audit.append({
        actor: user.id,
        role: user.role,
        action: 'lecture',
        resourceType: 'Recherche',
        resourceId: row.id,
        patientId: row.id,
        reason: this.policy.basisFor(user, row.id) === 'bris_de_glace' ? 'bris_de_glace' : 'soins',
      });
    }
    return { filtres: filters, resultats, total: all.length, page: request.page, taille: request.size };
  }

  /**
   * Interprète la requête (sauf si des filtres sont fournis) et renvoie tous les dossiers lisibles
   * correspondants, sans pagination ni audit (l'appelant audite ce qu'il affiche ou exporte).
   */
  evaluate(user: AuthenticatedUser, request: SearchRequest): { filters: SearchFilter[]; all: SearchResultRow[] } {
    this.policy.assertClinical(user);
    const today = this.clock.now().toISOString().slice(0, 10);
    const filters: SearchFilter[] = request.filters ?? this.interpreter.interpret(request.query);
    const files = this.repository
      .activePatients()
      .filter((patient) => this.policy.basisFor(user, patient.id) !== undefined)
      .map((patient): PatientFile => ({ patient, ...this.repository.recordOf(patient.id) }));
    return { filters, all: runSearch(files, filters, today) };
  }
}
