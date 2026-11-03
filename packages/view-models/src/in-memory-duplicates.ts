import type { Patient } from '@hygia/types';
import { GatewayError } from './http-client.js';
import type {
  DuplicateCandidate,
  MergeOutcome,
  MergeRequest,
  PatientSummary,
} from './types.js';

/** Seuil de détection hors ligne. */
const THRESHOLD = 0.85;

const words = (patient: Patient): string =>
  `${patient.givenName} ${patient.familyName}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join(' ');

/** Fiche affichable, avec les champs utiles à la comparaison. */
export function toSummary(patient: Patient): PatientSummary {
  const { id, ipp, familyName, givenName, birthDate, gender, phone, managingOrganization } = patient;
  return {
    id,
    ipp,
    familyName,
    givenName,
    birthDate,
    gender,
    managingOrganization,
    ...(phone === undefined ? {} : { phone }),
  };
}

/**
 * Doublons et fusions hors ligne (démo sans service) : score simplifié — nom à mots triés (0,55),
 * date de naissance (0,35), sexe (0,10), tous exacts. Le vrai score est celui du service Dossiers.
 */
export class InMemoryDuplicates {
  private readonly ignored = new Set<string>();
  private readonly merged = new Map<string, { id: string; keptId: string }>();
  private counter = 0;

  constructor(private readonly patients: () => readonly Patient[]) {}

  /** Vrai si la fiche a été fusionnée dans une autre. */
  isMerged(patientId: string): boolean {
    return this.merged.has(patientId);
  }

  list(): DuplicateCandidate[] {
    const active = this.patients().filter((patient) => !this.merged.has(patient.id));
    const found: DuplicateCandidate[] = [];
    for (const [index, a] of active.entries()) {
      for (const b of active.slice(index + 1)) {
        const name = Number(words(a) === words(b));
        const birthDate = Number(a.birthDate === b.birthDate);
        const gender = Number(a.gender === b.gender);
        const score = name * 0.55 + birthDate * 0.35 + gender * 0.1;
        const id = `${a.id}_${b.id}`;
        if (score >= THRESHOLD && !this.ignored.has(id)) {
          found.push({
            id,
            score,
            criteria: { name, birthDate, gender, phone: null },
            a: toSummary(a),
            b: toSummary(b),
          });
        }
      }
    }
    return found;
  }

  ignore(duplicateId: string): void {
    if (!this.list().some((pair) => pair.id === duplicateId)) {
      throw new GatewayError(404, 'Doublon introuvable');
    }
    this.ignored.add(duplicateId);
  }

  merge(keptId: string, mergedId: string, request: MergeRequest): MergeOutcome {
    const known = new Set(this.patients().map((patient) => patient.id));
    if (!known.has(keptId) || !known.has(mergedId)) throw new GatewayError(404, 'Patient introuvable');
    if (keptId === mergedId) throw new GatewayError(400, 'Deux dossiers distincts requis');
    if (this.merged.has(keptId) || this.merged.has(mergedId)) {
      throw new GatewayError(409, 'Un des dossiers a déjà été fusionné');
    }
    if (request.motif.trim() === '') throw new GatewayError(400, 'motif obligatoire');
    this.counter += 1;
    const id = `fusion-${this.counter}`;
    this.merged.set(mergedId, { id, keptId });
    return { id, keptId, mergedId, undone: false, moved: { encounters: 0, observations: 0, medicationRequests: 0, documents: 0 } };
  }

  undo(mergeId: string): MergeOutcome {
    for (const [mergedId, entry] of this.merged) {
      if (entry.id !== mergeId) continue;
      this.merged.delete(mergedId);
      return { id: mergeId, keptId: entry.keptId, mergedId, undone: true, moved: { encounters: 0, observations: 0, medicationRequests: 0, documents: 0 } };
    }
    throw new GatewayError(404, 'Fusion introuvable');
  }
}
