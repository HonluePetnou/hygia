/** Agent qui a levé une alerte. */
export type AlertAgentId = 'pharmacovigilance' | 'quality' | 'triage';

/** Onglet de l'écran des alertes (`?statut=` du service Dossiers). */
export type AlertTab = 'ouvertes' | 'acceptees' | 'rejetees';

/** Décision du soignant sur une alerte. */
export type AlertDecisionKind = 'accepter' | 'accepter_notifier' | 'rejeter';

/** Statut d'une alerte : `pending` tant qu'aucun soignant n'a décidé. */
export type AlertStatus = 'pending' | 'accepted' | 'accepted_notified' | 'rejected';

/** Alerte expliquée d'un agent (format `DetectedIssue` du service Dossiers). */
export interface AlertItem {
  id: string;
  version: number;
  patientId: string;
  agent: AlertAgentId;
  severity: 'low' | 'moderate' | 'high';
  title: string;
  reasoning: { step: number; text: string }[];
  sources: { document: { reference: string; display?: string }; excerpt: string }[];
  proposal: string;
  raisedAt: string;
  decision: {
    status: AlertStatus;
    decidedBy?: string;
    decidedAt?: string;
    justification?: string;
  };
}

/** Précision d'un agent sur 30 jours. */
export interface AgentPrecisionData {
  agent: AlertAgentId;
  accepted: number;
  decided: number;
  /** Acceptées / décidées (0 à 1), `null` sans décision. */
  rate: number | null;
}

/** Alerte avec la précision de son agent. */
export interface AlertDetailData extends AlertItem {
  precision: AgentPrecisionData;
}
