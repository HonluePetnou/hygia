import { BadRequestException } from '@nestjs/common';
import type { Change, ClockRecord } from '@hygia/sync-core';

/** Lot de changements envoyé par un terminal. */
export interface SyncRequest {
  /** Nœud émetteur (terminal). */
  nodeId: string;
  /** Changements effectués hors ligne, chacun avec sa clé d'idempotence. */
  changes: Change[];
  /** Horloge connue du terminal par ressource suivie (sert à calculer ce qui lui manque). */
  clocks: Record<string, ClockRecord>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new BadRequestException(`${name} : chaîne non vide attendue`);
  }
  return value;
}

function clock(value: unknown, name: string): ClockRecord {
  if (!isObject(value)) throw new BadRequestException(`${name} : objet de compteurs attendu`);
  for (const count of Object.values(value)) {
    if (!Number.isInteger(count) || (count as number) < 0) {
      throw new BadRequestException(`${name} : compteurs entiers positifs attendus`);
    }
  }
  return value as ClockRecord;
}

function change(raw: unknown, index: number): Change {
  const name = `changes[${index}]`;
  if (!isObject(raw)) throw new BadRequestException(`${name} : objet attendu`);
  if (raw['kind'] !== 'add' && raw['kind'] !== 'set') {
    throw new BadRequestException(`${name}.kind : « add » ou « set » attendu`);
  }
  if (!('value' in raw)) throw new BadRequestException(`${name}.value requis`);
  return {
    key: text(raw['key'], `${name}.key`),
    resourceId: text(raw['resourceId'], `${name}.resourceId`),
    patientId: text(raw['patientId'], `${name}.patientId`),
    kind: raw['kind'],
    field: text(raw['field'], `${name}.field`),
    value: raw['value'],
    clock: clock(raw['clock'], `${name}.clock`),
    nodeId: text(raw['nodeId'], `${name}.nodeId`),
    at: text(raw['at'], `${name}.at`),
  };
}

/**
 * Valide le corps de `POST /sync`.
 *
 * @throws BadRequestException si le lot est mal formé.
 */
export function parseSyncRequest(body: unknown): SyncRequest {
  if (!isObject(body)) throw new BadRequestException('Corps JSON attendu');
  const rawChanges = body['changes'] ?? [];
  if (!Array.isArray(rawChanges)) throw new BadRequestException('changes : tableau attendu');
  const rawClocks = body['clocks'] ?? {};
  if (!isObject(rawClocks)) throw new BadRequestException('clocks : objet attendu');
  return {
    nodeId: text(body['nodeId'], 'nodeId'),
    changes: rawChanges.map(change),
    clocks: Object.fromEntries(
      Object.entries(rawClocks).map(([id, value]) => [id, clock(value, `clocks.${id}`)]),
    ),
  };
}
