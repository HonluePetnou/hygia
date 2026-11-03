import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CLINICAL_DIRECTORY, type ClinicalDirectory } from './clinical-directory.js';

/**
 * Contrôle d'accès : seuls médecins et infirmiers de l'équipe de soins du patient interrogent
 * l'IA sur son dossier (403 sinon, 404 si le patient n'existe pas).
 */
@Injectable()
export class AccessPolicy {
  constructor(@Inject(CLINICAL_DIRECTORY) private readonly directory: ClinicalDirectory) {}

  /** Lève 403 / 404 si `user` ne peut pas lire le dossier de `patientId`. */
  require(user: AuthenticatedUser, patientId: string): void {
    if (user.role !== 'medecin' && user.role !== 'infirmier') {
      throw new ForbiddenException(`Le rôle ${user.role} n'a pas accès aux données de santé`);
    }
    if (!this.directory.exists(patientId)) throw new NotFoundException('Patient introuvable');
    if (!this.directory.isInCareTeam(user.id, patientId)) {
      throw new ForbiddenException("Ce patient n'appartient pas à votre équipe de soins");
    }
  }
}
