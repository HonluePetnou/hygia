import { createHash } from 'node:crypto';
import type { AuditEvent } from './types.js';

/** Entrée sans hachage : la partie couverte par le hachage. */
export type UnhashedEvent = Omit<AuditEvent, 'hash' | 'previousHash'>;

/** JSON canonique : clés triées, sans espace. */
export function canonicalJson(event: UnhashedEvent): string {
  const sorted = Object.fromEntries(
    Object.entries(event).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  return JSON.stringify(sorted);
}

/** `SHA-256(previousHash + JSON canonique de l'entrée)`, en hexadécimal. */
export function computeHash(previousHash: string, event: UnhashedEvent): string {
  return createHash('sha256')
    .update(previousHash + canonicalJson(event))
    .digest('hex');
}
