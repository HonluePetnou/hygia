import type { AuditEvent } from './types.js';

const COLUMNS = [
  'lamport',
  'timestamp',
  'actor',
  'role',
  'action',
  'resourceType',
  'resourceId',
  'patientId',
  'reason',
  'hash',
] as const;

/** Échappe une cellule CSV et neutralise les formules de tableur (`=`, `+`, `-`, `@`). */
function cell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Export CSV (RFC 4180, fins de ligne CRLF) du journal. */
export function toCsv(events: readonly AuditEvent[]): string {
  const lines: string[] = [COLUMNS.join(',')];
  for (const event of events) lines.push(COLUMNS.map((c) => cell(event[c])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}
