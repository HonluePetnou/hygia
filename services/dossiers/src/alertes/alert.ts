/** Agents qui produisent des alertes (section 8.5 du cahier des charges). */
export const ALERT_AGENTS = ['pharmacovigilance', 'quality', 'triage'] as const;
export type AlertAgent = (typeof ALERT_AGENTS)[number];

/** Gravité : `high` s'affiche « Critique ». */
export const ALERT_SEVERITIES = ['low', 'moderate', 'high'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

/** Décision du soignant. */
export const ALERT_DECISIONS = ['accepter', 'accepter_notifier', 'rejeter'] as const;
export type AlertDecision = (typeof ALERT_DECISIONS)[number];

/** État d'une alerte : `pending` tant qu'aucun soignant n'a décidé. */
export type AlertStatus = 'pending' | 'accepted' | 'accepted_notified' | 'rejected';

/** Filtre `?statut=` de `GET /alertes`. */
export const ALERT_STATUS_FILTERS = ['ouvertes', 'acceptees', 'rejetees'] as const;
export type AlertStatusFilter = (typeof ALERT_STATUS_FILTERS)[number];

/** Étape numérotée du raisonnement de l'agent. */
export interface ReasoningStep {
  step: number;
  text: string;
}

/** Source citée par l'alerte. */
export interface AlertSource {
  document: { reference: string; display?: string };
  excerpt: string;
}

/** Décision humaine enregistrée sur l'alerte. */
export interface DecisionRecord {
  status: AlertStatus;
  decidedBy?: string;
  decidedAt?: string;
  justification?: string;
}

/**
 * Alerte expliquée d'un agent, au format `DetectedIssue`. Elle ne modifie jamais le dossier :
 * seule la décision (`decision`) évolue.
 */
export interface AlertRecord {
  resourceType: 'DetectedIssue';
  /** UUID stable. */
  id: string;
  /** Numéro de version (contrôle optimiste), incrémenté à chaque décision. */
  version: number;
  patientId: string;
  agent: AlertAgent;
  severity: AlertSeverity;
  title: string;
  reasoning: ReasoningStep[];
  sources: AlertSource[];
  proposal: string;
  /** Date de levée de l'alerte (ISO). */
  raisedAt: string;
  decision: DecisionRecord;
}

/** Précision d'un agent sur la fenêtre de 30 jours. */
export interface AgentPrecision {
  agent: AlertAgent;
  accepted: number;
  decided: number;
  /** Acceptées / décidées (0 à 1), `null` sans décision. */
  rate: number | null;
}

/** Statuts correspondant à chaque onglet. */
export const STATUSES_OF_FILTER: Record<AlertStatusFilter, readonly AlertStatus[]> = {
  ouvertes: ['pending'],
  acceptees: ['accepted', 'accepted_notified'],
  rejetees: ['rejected'],
};
