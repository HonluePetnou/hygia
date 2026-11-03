import { Inject, Injectable } from '@nestjs/common';
import type { AuditLog } from '@hygia/audit';
import { mergeChanges, VectorClock, type Change, type ClockRecord } from '@hygia/sync-core';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import type { SyncRequest } from './sync-dto.js';
import { conflictId, SYNC_STORE, type StoredConflict, type SyncStore } from './sync-store.js';

/** Jeton d'injection du journal d'audit. */
export const AUDIT_LOG = Symbol('AUDIT_LOG');

/** Réponse de `POST /sync`. */
export interface SyncResponse {
  /** Changements du lot retenus (ni doublons, ni conflits). */
  merged: Change[];
  /** Changements du serveur que le terminal ne connaît pas encore. */
  remote: Change[];
  /** Conflits ouverts sur les ressources du lot, à arbitrer par un soignant. */
  conflicts: StoredConflict[];
  /** Changements du lot déjà traités (rejeu) : ignorés. */
  duplicates: number;
  /** Nouvelle horloge de chaque ressource. */
  clocks: Record<string, ClockRecord>;
}

const unknownBy = (known: ClockRecord | undefined) => (change: Change) =>
  !['before', 'equal'].includes(new VectorClock(change.clock).compare(new VectorClock(known)));

/**
 * Fusion des changements d'un terminal avec l'état du serveur. « Exactement une fois » au niveau
 * métier : livraison au moins une fois (le terminal rejoue) + clé d'idempotence par changement.
 */
@Injectable()
export class SyncService {
  constructor(
    @Inject(SYNC_STORE) private readonly store: SyncStore,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  /** Applique un lot et renvoie ce qui a été fusionné, les conflits et les nouvelles horloges. */
  sync(user: AuthenticatedUser, request: SyncRequest): SyncResponse {
    const fresh = new Map<string, Change>();
    for (const change of request.changes) {
      if (!this.store.seen.has(change.key) && !fresh.has(change.key)) fresh.set(change.key, change);
    }
    const duplicates = request.changes.length - fresh.size;
    const touched = new Set(request.changes.map((c) => c.resourceId));

    const known = this.store.log.filter((c) => touched.has(c.resourceId));
    const { merged, conflicts } = mergeChanges([...fresh.values()], known);
    for (const conflict of conflicts) {
      const id = conflictId(conflict);
      if (!this.store.conflicts.has(id)) {
        this.store.conflicts.set(id, { ...conflict, id, status: 'open' });
      }
    }
    // Le serveur garde sa version tant que le conflit n'est pas arbitré.
    const held = conflicts.map((c) => c.remote);
    this.store.log = [
      ...this.store.log.filter((c) => !touched.has(c.resourceId)),
      ...merged,
      ...held,
    ];
    for (const key of fresh.keys()) this.store.seen.add(key);

    const appliedKeys = new Set(merged.map((c) => c.key));
    const applied = [...fresh.values()].filter((c) => appliedKeys.has(c.key));
    this.auditBatch(user, request.nodeId, applied);

    const sent = new Set(request.changes.map((c) => c.key));
    const resources = new Set([...touched, ...Object.keys(request.clocks)]);
    const remote = this.store.log.filter(
      (c) =>
        resources.has(c.resourceId) &&
        !sent.has(c.key) &&
        unknownBy(request.clocks[c.resourceId])(c),
    );
    return {
      merged: applied,
      remote,
      conflicts: this.openConflicts(touched),
      duplicates,
      clocks: this.clocksOf(resources, request),
    };
  }

  /** Enregistre un changement produit côté serveur (idempotent sur sa clé). */
  recordServerChange(change: Change): void {
    if (this.store.seen.has(change.key)) return;
    this.store.seen.add(change.key);
    this.store.log.push(change);
  }

  /** Conflits en attente, sur les ressources données (toutes si omis). */
  openConflicts(resources?: ReadonlySet<string>): StoredConflict[] {
    return [...this.store.conflicts.values()].filter(
      (c) => c.status === 'open' && (resources === undefined || resources.has(c.resourceId)),
    );
  }

  private clocksOf(resources: Set<string>, request: SyncRequest): Record<string, ClockRecord> {
    const result: Record<string, ClockRecord> = {};
    for (const id of resources) {
      let clock = new VectorClock(request.clocks[id]);
      for (const c of this.store.changesOf(id)) clock = clock.merge(new VectorClock(c.clock));
      for (const c of request.changes)
        if (c.resourceId === id) clock = clock.merge(new VectorClock(c.clock));
      result[id] = clock.toJSON();
    }
    return result;
  }

  private auditBatch(user: AuthenticatedUser, nodeId: string, applied: Change[]): void {
    const byPatient = new Map<string, Change[]>();
    for (const c of applied) byPatient.set(c.patientId, [...(byPatient.get(c.patientId) ?? []), c]);
    for (const [patientId, changes] of byPatient) {
      this.audit.append({
        actor: user.id,
        role: user.role,
        action: 'modification',
        resourceType: 'Synchronisation',
        resourceId: changes[0]?.resourceId ?? '',
        patientId,
        reason: `sync ${nodeId} : ${changes.length} changement(s)`,
      });
    }
  }
}
