import { Inject, Injectable } from '@nestjs/common';
import type { AuditEvent, AuditLog } from '@hygia/audit';
import type { TokenClaims } from '@hygia/auth';

/** Jeton d'injection du journal d'audit du service. */
export const AUDIT_LOG = Symbol('AUDIT_LOG');

/** Patient factice des événements qui ne concernent aucun dossier. */
export const NO_PATIENT = '-';

/** Détails d'une action d'administration à journaliser. */
export interface AdminAction {
  kind: 'creation' | 'modification';
  resourceType: 'compte' | 'equipe';
  resourceId: string;
  /** Texte libre, sans donnée de santé ni secret (jamais de mot de passe ni de code). */
  reason: string;
  patientId?: string;
}

/** Journalise chaque action d'administration (comptes, rôles, équipes) dans le journal chaîné. */
@Injectable()
export class AdminAudit {
  constructor(@Inject(AUDIT_LOG) private readonly log: AuditLog) {}

  /** Ajoute l'événement et le renvoie. */
  record(claims: TokenClaims, action: AdminAction): AuditEvent {
    return this.log.append({
      actor: claims.sub,
      role: claims.role,
      action: action.kind,
      resourceType: action.resourceType,
      resourceId: action.resourceId,
      patientId: action.patientId ?? NO_PATIENT,
      reason: action.reason,
    });
  }

  /** Événements journalisés, du plus ancien au plus récent. */
  events(): readonly AuditEvent[] {
    return this.log.events();
  }
}
