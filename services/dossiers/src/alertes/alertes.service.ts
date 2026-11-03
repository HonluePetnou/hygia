import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditLog } from '@hygia/audit';
import { AccessPolicy } from '../access/access-policy.js';
import { CLOCK, type Clock } from '../access/clock.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AUDIT_LOG } from '../patients/audit-token.js';
import {
  STATUSES_OF_FILTER,
  type AgentPrecision,
  type AlertAgent,
  type AlertRecord,
  type AlertStatus,
  type AlertStatusFilter,
} from './alert.js';
import { ALERT_EVENTS, type AlertEventPublisher } from './alert-events.js';
import { ALERT_REPOSITORY, type AlertRepository } from './alert-repository.js';
import type { ParsedDecision } from './dto.js';
import { computePrecision } from './precision.js';

/** Alerte avec la précision de son agent sur 30 jours. */
export interface AlertDetail extends AlertRecord {
  precision: AgentPrecision;
}

const STATUS_OF_DECISION: Record<ParsedDecision['decision'], AlertStatus> = {
  accepter: 'accepted',
  accepter_notifier: 'accepted_notified',
  rejeter: 'rejected',
};

/**
 * Alertes des agents : lecture, décision du soignant et précision par agent (section 8.5).
 * Une alerte ne modifie jamais le dossier : une décision enregistre seulement le retour humain.
 */
@Injectable()
export class AlertesService {
  constructor(
    @Inject(ALERT_REPOSITORY) private readonly repository: AlertRepository,
    @Inject(ALERT_EVENTS) private readonly events: AlertEventPublisher,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly policy: AccessPolicy,
  ) {}

  /** Alertes des patients lisibles par l'utilisateur, de la plus récente à la plus ancienne. */
  list(user: AuthenticatedUser, filter?: AlertStatusFilter): AlertRecord[] {
    this.policy.assertClinical(user);
    const statuses = filter === undefined ? undefined : STATUSES_OF_FILTER[filter];
    const found = this.repository
      .all()
      .filter((alert) => this.policy.basisFor(user, alert.patientId) !== undefined)
      .filter((alert) => statuses === undefined || statuses.includes(alert.decision.status))
      .sort((a, b) => Date.parse(b.raisedAt) - Date.parse(a.raisedAt));
    for (const patientId of new Set(found.map((alert) => alert.patientId))) {
      this.record(user, patientId, 'lecture', patientId, 'consultation des alertes IA');
    }
    return found;
  }

  /** Détail d'une alerte et précision de son agent (lecture auditée). */
  get(user: AuthenticatedUser, id: string): AlertDetail {
    const alert = this.readable(user, id);
    this.record(user, alert.patientId, 'lecture', alert.id, 'consultation d’une alerte IA');
    return { ...alert, precision: this.precisionOf(alert.agent) };
  }

  /** Précision de chaque agent sur 30 jours. */
  precision(user: AuthenticatedUser): AgentPrecision[] {
    this.policy.assertClinical(user);
    return computePrecision(this.repository.all(), this.clock.now());
  }

  /**
   * Enregistre la décision du soignant. Rejet : justification obligatoire (vérifiée par
   * `parseDecision`). « Accepter et notifier » publie un événement pour le service Notification.
   */
  decide(user: AuthenticatedUser, id: string, parsed: ParsedDecision): AlertDetail {
    const alert = this.readable(user, id);
    if (alert.decision.status !== 'pending') throw new ConflictException('Alerte déjà traitée');
    const now = this.clock.now().toISOString();
    alert.decision = {
      status: STATUS_OF_DECISION[parsed.decision],
      decidedBy: user.id,
      decidedAt: now,
      ...(parsed.justification === undefined ? {} : { justification: parsed.justification }),
    };
    alert.version += 1;
    this.repository.save(alert);
    this.record(user, alert.patientId, 'modification', alert.id, `décision sur alerte IA : ${parsed.decision}`);
    if (parsed.decision === 'accepter_notifier') {
      this.events.publish({
        type: 'alerte.notification',
        alertId: alert.id,
        patientId: alert.patientId,
        agent: alert.agent,
        severity: alert.severity,
        title: alert.title,
        requestedBy: user.id,
        at: now,
      });
    }
    return { ...alert, precision: this.precisionOf(alert.agent) };
  }

  /** Reçoit une alerte d'un agent (rôle `admin`, compte de service) ; idempotent sur l'UUID. */
  ingest(user: AuthenticatedUser, alert: AlertRecord): AlertRecord {
    if (user.role !== 'admin') throw new ForbiddenException('Seul le compte de service des agents peut déposer une alerte');
    if (this.repository.find(alert.id) === undefined) this.repository.save(alert);
    return this.repository.find(alert.id) as AlertRecord;
  }

  private precisionOf(agent: AlertAgent): AgentPrecision {
    return computePrecision(this.repository.all(), this.clock.now()).find((p) => p.agent === agent) as AgentPrecision;
  }

  private readable(user: AuthenticatedUser, id: string): AlertRecord {
    this.policy.assertClinical(user);
    const alert = this.repository.find(id);
    if (!alert) throw new NotFoundException('Alerte introuvable');
    this.policy.requireAccess(user, alert.patientId);
    return alert;
  }

  private record(
    user: AuthenticatedUser,
    patientId: string,
    action: 'lecture' | 'modification',
    resourceId: string,
    reason: string,
  ): void {
    this.audit.append({
      actor: user.id,
      role: user.role,
      action,
      resourceType: 'Alertes',
      resourceId,
      patientId,
      reason: this.policy.basisFor(user, patientId) === 'bris_de_glace' ? 'bris_de_glace' : reason,
    });
  }
}
