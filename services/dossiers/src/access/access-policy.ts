import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { PATIENT_REPOSITORY, type PatientRepository } from '../patients/patient-repository.js';
import { CLOCK, type Clock } from './clock.js';

/** Origine d'un accès accordé : équipe de soins ou bris de glace. */
export type AccessBasis = 'equipe' | 'bris_de_glace';

/**
 * Contrôle d'accès aux dossiers (RF23, matrice 11.2 simplifiée) :
 * seuls médecins et infirmiers accèdent aux données de santé, et uniquement pour les patients de
 * leur équipe de soins ou sous bris de glace. L'administrateur système n'y a jamais accès.
 */
@Injectable()
export class AccessPolicy {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly patients: PatientRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Fin de l'accès d'urgence du jeton sur ce patient, s'il est encore actif. */
  emergencyExpiry(user: AuthenticatedUser, patientId: string): string | undefined {
    const now = this.clock.now().getTime();
    return user.emergency.find((g) => g.patientId === patientId && Date.parse(g.expiresAt) > now)
      ?.expiresAt;
  }

  /** Vrai si le rôle peut un jour accéder à des données de santé. */
  static isClinical(user: AuthenticatedUser): boolean {
    return user.role === 'medecin' || user.role === 'infirmier';
  }

  /** Refuse (403) les rôles sans accès aux données de santé. */
  assertClinical(user: AuthenticatedUser): void {
    if (!AccessPolicy.isClinical(user)) {
      throw new ForbiddenException(`Le rôle ${user.role} n'a pas accès aux données de santé`);
    }
  }

  /** Base de l'accès, ou `undefined` si l'utilisateur n'a pas le droit de lire ce patient. */
  basisFor(user: AuthenticatedUser, patientId: string): AccessBasis | undefined {
    if (!AccessPolicy.isClinical(user)) return undefined;
    if (user.teams.length > 0 && this.patients.patientIdsOfCareTeams(user.id).has(patientId)) {
      return 'equipe';
    }
    if (this.emergencyExpiry(user, patientId) !== undefined) return 'bris_de_glace';
    return undefined;
  }

  /** Renvoie la base de l'accès ou lève 403. */
  requireAccess(user: AuthenticatedUser, patientId: string): AccessBasis {
    this.assertClinical(user);
    const basis = this.basisFor(user, patientId);
    if (!basis) throw new ForbiddenException("Ce patient n'appartient pas à votre équipe de soins");
    return basis;
  }
}
