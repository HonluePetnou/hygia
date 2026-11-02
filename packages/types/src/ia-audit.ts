import type { BaseResource, IsoDateTime, Reference, Role } from './common.js';

/** Décision du soignant sur une alerte IA (l'IA ne modifie jamais un dossier). */
export interface ClinicianDecision {
  /** Accepté, rejeté ou en attente. */
  status: 'pending' | 'accepted' | 'rejected';
  /** Soignant décideur (absent tant qu'en attente). */
  decidedBy?: Reference;
  /** Date de la décision. */
  decidedAt?: IsoDateTime;
}

/** Source citée à l'appui d'une alerte. */
export interface SourceCitation {
  /** Document source. */
  document: Reference;
  /** Extrait cité. */
  excerpt: string;
}

/** Alerte produite par un agent IA. */
export interface DetectedIssue extends BaseResource {
  resourceType: 'DetectedIssue';
  subject: Reference;
  /** Agent à l'origine de l'alerte. */
  agent: string;
  /** Gravité. */
  severity: 'low' | 'moderate' | 'high';
  /** Explication en langage clair. */
  explanation: string;
  /** Sources citées. */
  sources: SourceCitation[];
  /** Décision du soignant. */
  decision: ClinicianDecision;
}

/** Entrée du journal d'audit chaîné par hachage. */
export interface AuditEvent extends BaseResource {
  resourceType: 'AuditEvent';
  /** Acteur (identifiant et rôle). */
  actor: { id: string; role: Role };
  /** Action réalisée. */
  action: 'read' | 'create' | 'update' | 'delete' | 'decision';
  /** Ressource concernée (`Type/id`). */
  resource: Reference;
  /** Motif de l'accès. */
  reason: string;
  /** Horodatage. */
  recordedAt: IsoDateTime;
  /** Estampille de Lamport. */
  lamport: number;
  /** Hachage de l'événement précédent (chaîne vide pour le premier). */
  previousHash: string;
  /** Hachage de cet événement. */
  hash: string;
}
