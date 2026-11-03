import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuditLog } from '@hygia/audit';
import { VectorClock, type Change } from '@hygia/sync-core';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AUDIT_LOG } from './sync.service.js';
import {
  SYNC_STORE,
  type ConflictChoice,
  type StoredConflict,
  type SyncStore,
} from './sync-store.js';

/** Jeton d'injection de l'horloge murale. */
export const CLOCK = Symbol('CLOCK');

/** Nœud qui signe les arbitrages. */
export const SERVER_NODE = 'serveur';

/** Arbitrage d'un conflit par un soignant : le choix devient la nouvelle version, tracée à l'audit. */
@Injectable()
export class ConflictService {
  constructor(
    @Inject(SYNC_STORE) private readonly store: SyncStore,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    @Inject(CLOCK) private readonly now: () => Date,
  ) {}

  /**
   * Tranche un conflit ouvert. La version retenue reçoit une horloge qui domine les deux versions,
   * si bien que les terminaux la reprennent à leur prochaine synchronisation.
   *
   * @throws NotFoundException conflit inconnu ; ConflictException déjà arbitré ;
   *   BadRequestException choix invalide.
   */
  resolve(
    user: AuthenticatedUser,
    id: string,
    choice: unknown,
    manualValue: unknown,
  ): StoredConflict {
    const conflict = this.store.conflicts.get(id);
    if (conflict === undefined) throw new NotFoundException('Conflit inconnu');
    if (conflict.status === 'resolved') throw new ConflictException('Conflit déjà arbitré');
    if (choice !== 'local' && choice !== 'remote' && choice !== 'manual') {
      throw new BadRequestException('choice : « local », « remote » ou « manual » attendu');
    }
    if (choice === 'manual' && manualValue === undefined) {
      throw new BadRequestException('value requis pour un choix manuel');
    }
    const value = choice === 'manual' ? manualValue : conflict[choice].value;
    const at = this.now().toISOString();
    const clock = new VectorClock(conflict.local.clock)
      .merge(new VectorClock(conflict.remote.clock))
      .increment(SERVER_NODE);
    const change: Change = {
      key: `arbitrage:${id}`,
      resourceId: conflict.resourceId,
      patientId: conflict.patientId,
      kind: 'set',
      field: conflict.field,
      value,
      clock: clock.toJSON(),
      nodeId: SERVER_NODE,
      at,
    };
    this.store.log = [
      ...this.store.log.filter(
        (c) =>
          !(c.kind === 'set' && c.resourceId === conflict.resourceId && c.field === conflict.field),
      ),
      change,
    ];
    this.store.seen.add(change.key);
    const resolved: StoredConflict = {
      ...conflict,
      status: 'resolved',
      resolution: {
        choice: choice as ConflictChoice,
        value,
        by: user.id,
        at,
        changeKey: change.key,
      },
    };
    this.store.conflicts.set(id, resolved);
    this.audit.append({
      actor: user.id,
      role: user.role,
      action: 'modification',
      resourceType: 'ConflitSynchronisation',
      resourceId: conflict.resourceId,
      patientId: conflict.patientId,
      reason: `arbitrage ${id} (${conflict.field}) : ${choice}`,
    });
    return resolved;
  }
}
