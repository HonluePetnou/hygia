import { createHash } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditLog } from '@hygia/audit';
import type { Patient } from '@hygia/types';
import { AccessPolicy } from '../access/access-policy.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AUDIT_LOG } from '../patients/audit-token.js';
import { PATIENT_REPOSITORY, type PatientRepository } from '../patients/patient-repository.js';
import { compare, type CriteriaScores } from './similarity.js';

/** Jeton d'injection du seuil de détection (0 à 1). */
export const DUPLICATE_THRESHOLD = Symbol('DUPLICATE_THRESHOLD');

/** Doublon probable : deux fiches, leur score et le détail par critère. */
export interface DuplicateCandidate {
  id: string;
  /** Score entre 0 et 1. */
  score: number;
  criteria: CriteriaScores;
  a: Patient;
  b: Patient;
}

/** Identifiant stable (UUID déterministe) d'une paire, indépendant de l'ordre des fiches. */
export function pairId(first: string, second: string): string {
  const hex = createHash('sha1').update([first, second].sort().join('|')).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Détection des doublons d'identité (RF4) ; les paires ignorées ne sont plus proposées. */
@Injectable()
export class DuplicatesService {
  private readonly ignored = new Set<string>();

  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repository: PatientRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    @Inject(DUPLICATE_THRESHOLD) private readonly threshold: number,
    private readonly policy: AccessPolicy,
  ) {}

  /** Paires dont le score atteint le seuil, non ignorées, entre patients lisibles par l'utilisateur. */
  list(user: AuthenticatedUser): DuplicateCandidate[] {
    this.policy.assertClinical(user);
    const readable = this.repository
      .activePatients()
      .filter((patient) => this.policy.basisFor(user, patient.id) !== undefined);
    const found: DuplicateCandidate[] = [];
    for (const [index, a] of readable.entries()) {
      for (const b of readable.slice(index + 1)) {
        const { score, criteria } = compare(a, b);
        const id = pairId(a.id, b.id);
        if (score >= this.threshold && !this.ignored.has(id)) found.push({ id, score, criteria, a, b });
      }
    }
    for (const patient of new Set(found.flatMap((pair) => [pair.a, pair.b]))) {
      this.record(user, patient, 'lecture', 'Doublons', 'recherche de doublons');
    }
    return found.sort((x, y) => y.score - x.score);
  }

  /** Ignore une paire (le refus est tracé dans l'audit des deux dossiers). */
  ignore(user: AuthenticatedUser, id: string): void {
    const pair = this.list(user).find((candidate) => candidate.id === id);
    if (!pair) throw new NotFoundException('Doublon introuvable');
    this.ignored.add(id);
    for (const patient of [pair.a, pair.b]) {
      this.record(user, patient, 'modification', 'Doublons', 'doublon ignoré');
    }
  }

  private record(
    user: AuthenticatedUser,
    patient: Patient,
    action: 'lecture' | 'modification',
    resourceType: string,
    reason: string,
  ): void {
    this.audit.append({
      actor: user.id,
      role: user.role,
      action,
      resourceType,
      resourceId: patient.id,
      patientId: patient.id,
      reason: this.policy.basisFor(user, patient.id) === 'bris_de_glace' ? 'bris_de_glace' : reason,
    });
  }
}
