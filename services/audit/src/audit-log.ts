import type { AuditStore } from './audit-store.js';
import { computeHash, type UnhashedEvent } from './hashing.js';
import { LamportClock } from './lamport-clock.js';
import type { AuditEntryInput, AuditEvent, VerifyResult } from './types.js';

/** Journal d'audit chaîné par hachage, avec estampilles de Lamport. */
export class AuditLog {
  constructor(
    private readonly store: AuditStore,
    private readonly clock: LamportClock = new LamportClock(),
    /** Horloge murale injectable (tests déterministes). */
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Ajoute une entrée et renvoie l'événement créé. */
  append(input: AuditEntryInput): AuditEvent {
    const events = this.store.all();
    const last = events[events.length - 1];
    const previousHash = last?.hash ?? '';
    const body: UnhashedEvent = {
      ...input,
      index: events.length,
      lamport: this.clock.tick(),
      timestamp: this.now().toISOString(),
    };
    const event: AuditEvent = { ...body, previousHash, hash: computeHash(previousHash, body) };
    this.store.append(event);
    return event;
  }

  /** Vérifie toute la chaîne ; renvoie la position de la première rupture. */
  verify(): VerifyResult {
    let previousHash = '';
    const events = this.store.all();
    for (let i = 0; i < events.length; i += 1) {
      const { hash, previousHash: claimedPrevious, ...body } = events[i] as AuditEvent;
      if (
        claimedPrevious !== previousHash ||
        body.index !== i ||
        hash !== computeHash(previousHash, body)
      ) {
        return { intact: false, brokenAt: i };
      }
      previousHash = hash;
    }
    return { intact: true };
  }

  /** Toutes les entrées, de la plus ancienne à la plus récente. */
  events(): readonly AuditEvent[] {
    return this.store.all();
  }

  /** Entrées concernant un patient (« Qui a vu mon dossier ? »). */
  forPatient(patientId: string): AuditEvent[] {
    return this.store.all().filter((event) => event.patientId === patientId);
  }
}
