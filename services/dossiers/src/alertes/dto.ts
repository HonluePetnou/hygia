import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { asObject } from '../patients/dto.js';
import {
  ALERT_AGENTS,
  ALERT_DECISIONS,
  ALERT_SEVERITIES,
  ALERT_STATUS_FILTERS,
  type AlertAgent,
  type AlertDecision,
  type AlertRecord,
  type AlertSeverity,
  type AlertSource,
  type AlertStatusFilter,
} from './alert.js';

/** Corps de `POST /alertes/:id/decision`. */
export class DecisionDto {
  @ApiProperty({ enum: ALERT_DECISIONS }) decision!: AlertDecision;
  @ApiPropertyOptional({ description: 'Obligatoire en cas de rejet' }) justification?: string;
}

/** Décision validée. */
export interface ParsedDecision {
  decision: AlertDecision;
  justification?: string;
}

/** Valide une décision : valeur connue, justification non vide obligatoire pour un rejet. */
export function parseDecision(body: unknown): ParsedDecision {
  const source = asObject(body);
  const decision = source['decision'];
  if (typeof decision !== 'string' || !(ALERT_DECISIONS as readonly string[]).includes(decision)) {
    throw new BadRequestException(`decision invalide (${ALERT_DECISIONS.join(', ')} attendu)`);
  }
  const raw = source['justification'];
  if (raw !== undefined && typeof raw !== 'string') throw new BadRequestException('justification doit être un texte');
  const justification = raw?.trim();
  if (decision === 'rejeter' && !justification) {
    throw new BadRequestException('justification obligatoire en cas de rejet');
  }
  return { decision: decision as AlertDecision, ...(justification ? { justification } : {}) };
}

/** Valide `?statut=` (absent : toutes les alertes). */
export function parseStatusFilter(value: unknown): AlertStatusFilter | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !(ALERT_STATUS_FILTERS as readonly string[]).includes(value)) {
    throw new BadRequestException(`statut invalide (${ALERT_STATUS_FILTERS.join(', ')} attendu)`);
  }
  return value as AlertStatusFilter;
}

const text = (source: Record<string, unknown>, key: string): string => {
  const value = source[key];
  if (typeof value !== 'string' || value.trim() === '') throw new BadRequestException(`${key} obligatoire`);
  return value;
};

const oneOf = <T extends string>(value: string, allowed: readonly T[], key: string): T => {
  if (!(allowed as readonly string[]).includes(value)) throw new BadRequestException(`${key} invalide`);
  return value as T;
};

function parseSources(value: unknown): AlertSource[] {
  if (!Array.isArray(value)) throw new BadRequestException('sources : tableau attendu');
  return value.map((entry) => {
    const item = asObject(entry);
    const document = asObject(item['document']);
    const display = document['display'];
    return {
      document: { reference: text(document, 'reference'), ...(typeof display === 'string' ? { display } : {}) },
      excerpt: text(item, 'excerpt'),
    };
  });
}

/**
 * Valide une alerte produite par un agent (JSON `DetectedIssue` de `services/agents`) :
 * `subject` = `Patient/<uuid>` ; la décision est toujours `pending` à l'arrivée.
 */
export function parseIssue(body: unknown, now: Date): AlertRecord {
  const source = asObject(body);
  const subject = text(asObject(source['subject']), 'reference');
  if (!subject.startsWith('Patient/')) throw new BadRequestException('subject : Patient/<id> attendu');
  const reasoning = source['reasoning'];
  if (!Array.isArray(reasoning) || reasoning.length === 0) throw new BadRequestException('reasoning obligatoire');
  const raisedAt = typeof source['raisedAt'] === 'string' ? source['raisedAt'] : now.toISOString();
  return {
    resourceType: 'DetectedIssue',
    id: text(source, 'id'),
    version: 1,
    patientId: subject.slice('Patient/'.length),
    agent: oneOf<AlertAgent>(text(source, 'agent'), ALERT_AGENTS, 'agent'),
    severity: oneOf<AlertSeverity>(text(source, 'severity'), ALERT_SEVERITIES, 'severity'),
    title: text(source, 'title'),
    reasoning: reasoning.map((entry, index) => ({ step: index + 1, text: text(asObject(entry), 'text') })),
    sources: parseSources(source['sources']),
    proposal: text(source, 'proposal'),
    raisedAt,
    decision: { status: 'pending' },
  };
}
