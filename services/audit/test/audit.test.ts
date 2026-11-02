import { describe, expect, it } from 'vitest';
import {
  AuditLog,
  InMemoryAuditStore,
  LamportClock,
  type AuditEntryInput,
  type AuditEvent,
} from '../src/index.js';

const entry = (n: number, patientId = 'p1'): AuditEntryInput => ({
  actor: `u${n}`,
  role: 'medecin',
  action: 'lecture',
  resourceType: 'Patient',
  resourceId: `r${n}`,
  patientId,
  reason: 'soins',
});

describe('LamportClock', () => {
  it('tick incrémente', () => {
    const c = new LamportClock();
    expect([c.tick(), c.tick(), c.value]).toEqual([1, 2, 2]);
  });

  it('receive prend max + 1', () => {
    const c = new LamportClock();
    c.tick();
    expect(c.receive(10)).toBe(11);
    expect(c.receive(3)).toBe(12);
  });
});

describe('AuditLog', () => {
  it('chaîne intacte après 100 entrées', () => {
    const log = new AuditLog(new InMemoryAuditStore());
    for (let i = 0; i < 100; i += 1) log.append(entry(i));
    expect(log.verify()).toEqual({ intact: true });
  });

  it('détecte une modification au milieu à la bonne position', () => {
    const store = new InMemoryAuditStore();
    const log = new AuditLog(store);
    for (let i = 0; i < 20; i += 1) log.append(entry(i));
    const target = store.all()[7] as AuditEvent;
    (target as { reason: string }).reason = 'falsifié';
    expect(log.verify()).toEqual({ intact: false, brokenAt: 7 });
  });

  it('estampilles de Lamport strictement croissantes', () => {
    const log = new AuditLog(new InMemoryAuditStore());
    const stamps = Array.from({ length: 10 }, (_, i) => log.append(entry(i)).lamport);
    stamps.slice(1).forEach((s, i) => expect(s).toBeGreaterThan(stamps[i] as number));
  });

  it('chaîne les hachages', () => {
    const log = new AuditLog(new InMemoryAuditStore());
    const a = log.append(entry(1));
    const b = log.append(entry(2));
    expect(a.previousHash).toBe('');
    expect(b.previousHash).toBe(a.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('forPatient filtre', () => {
    const log = new AuditLog(new InMemoryAuditStore());
    log.append(entry(1, 'p1'));
    log.append(entry(2, 'p2'));
    log.append(entry(3, 'p1'));
    expect(log.forPatient('p1').map((e) => e.actor)).toEqual(['u1', 'u3']);
  });
});
