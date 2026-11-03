import { randomUUID } from 'node:crypto';
import type { AuditEvent } from './types.js';

/** Demandes d'un patient à la DPO : droits RGPD-like (loi n° 2024/017) et signalement d'accès suspect. */
export const RIGHTS_KINDS = [
  'telechargement',
  'rectification',
  'suppression',
  'signalement',
] as const;

export type RightsKind = (typeof RIGHTS_KINDS)[number];

/** Délai de traitement par la DPO, en jours. */
export const RIGHTS_DEADLINE_DAYS = 30;

/** Demande enregistrée ; visible du patient qui l'a faite et de la DPO (rôle auditeur). */
export interface RightsRequest {
  id: string;
  version: number;
  patientId: string;
  kind: RightsKind;
  /** Précisions du patient (facultatives). */
  message: string;
  /** Pour un signalement : position dans le journal de l'accès signalé. */
  eventIndex?: number;
  /** Résumé de l'accès signalé (acteur, action), copié pour la DPO. */
  eventSummary?: string;
  createdAt: string;
  /** Échéance de traitement (30 jours). */
  dueAt: string;
  status: 'ouverte';
}

/** Champs fournis par le patient. */
export interface RightsRequestInput {
  kind: RightsKind;
  message: string;
  eventIndex?: number;
}

/** Erreur de validation d'une demande. */
export class RightsRequestError extends Error {}

/** Registre en mémoire des demandes (remplaçable par une table). */
export class RightsRegistry {
  private readonly requests: RightsRequest[] = [];

  constructor(private readonly now: () => Date = () => new Date()) {}

  /**
   * Enregistre une demande du patient. Un signalement doit désigner une entrée du journal
   * qui concerne ce patient.
   *
   * @throws RightsRequestError si le type est inconnu ou l'accès signalé introuvable.
   */
  create(
    patientId: string,
    input: RightsRequestInput,
    events: readonly AuditEvent[],
  ): RightsRequest {
    if (!(RIGHTS_KINDS as readonly string[]).includes(input.kind))
      throw new RightsRequestError('kind invalide');
    if (input.message.length > 2000) throw new RightsRequestError('message trop long');
    const created = this.now();
    const request: RightsRequest = {
      id: randomUUID(),
      version: 1,
      patientId,
      kind: input.kind,
      message: input.message,
      createdAt: created.toISOString(),
      dueAt: new Date(created.getTime() + RIGHTS_DEADLINE_DAYS * 86_400_000).toISOString(),
      status: 'ouverte',
    };
    if (input.kind === 'signalement') {
      const event = events.find((e) => e.index === input.eventIndex && e.patientId === patientId);
      if (event === undefined)
        throw new RightsRequestError('accès signalé introuvable dans votre journal');
      request.eventIndex = event.index;
      request.eventSummary = `${event.actor} · ${event.action} · ${event.timestamp}`;
    }
    this.requests.push(request);
    return { ...request };
  }

  /** Demandes d'un patient, ou toutes si `patientId` est absent ; la plus récente d'abord. */
  list(patientId?: string): RightsRequest[] {
    return this.requests
      .filter((r) => patientId === undefined || r.patientId === patientId)
      .map((r) => ({ ...r }))
      .reverse();
  }
}
