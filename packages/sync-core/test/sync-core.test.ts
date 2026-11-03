import { describe, expect, it } from 'vitest';
import { mergeChanges, VectorClock, type Change } from '../src/index.js';

const change = (over: Partial<Change> & Pick<Change, 'key'>): Change => ({
  resourceId: 'r1',
  patientId: 'p1',
  kind: 'add',
  field: 'observations',
  value: over.key,
  clock: {},
  nodeId: 'tablette',
  at: '2026-11-03T08:00:00.000Z',
  ...over,
});

describe('VectorClock', () => {
  it('incrémente sans modifier l’original', () => {
    const a = new VectorClock();
    const b = a.increment('t1').increment('t1');
    expect(a.get('t1')).toBe(0);
    expect(b.get('t1')).toBe(2);
  });

  it('compare : avant, après, égal, concurrent', () => {
    const a = new VectorClock({ t1: 1 });
    const b = a.increment('t1');
    expect(a.compare(b)).toBe('before');
    expect(b.compare(a)).toBe('after');
    expect(a.compare(new VectorClock({ t1: 1 }))).toBe('equal');
    expect(a.increment('t2').compare(a.increment('serveur'))).toBe('concurrent');
  });

  it('fusionne par maximum (commutatif, idempotent)', () => {
    const a = new VectorClock({ t1: 3, s: 1 });
    const b = new VectorClock({ t1: 1, s: 4 });
    expect(a.merge(b).toJSON()).toEqual({ t1: 3, s: 4 });
    expect(b.merge(a).toJSON()).toEqual(a.merge(b).toJSON());
    expect(a.merge(a).toJSON()).toEqual(a.toJSON());
  });

  it('refuse un compteur invalide', () => {
    expect(() => new VectorClock({ t1: -1 })).toThrow(RangeError);
  });
});

describe('mergeChanges', () => {
  it('fusionne 6 ajouts sans conflit ni doublon', () => {
    const local = [1, 2, 3].map((n) => change({ key: `t-${n}`, clock: { tablette: n } }));
    const remote = [1, 2, 3].map((n) =>
      change({ key: `s-${n}`, nodeId: 'serveur', clock: { serveur: n } }),
    );
    const { merged, conflicts } = mergeChanges(local, remote);
    expect(merged).toHaveLength(6);
    expect(conflicts).toEqual([]);
    expect(mergeChanges(local, [...remote, ...local]).merged).toHaveLength(6);
  });

  it('la version dominante gagne', () => {
    const old = change({
      key: 'a',
      kind: 'set',
      field: 'posologie',
      value: '20 mg',
      clock: { serveur: 1 },
    });
    const next = change({
      key: 'b',
      kind: 'set',
      field: 'posologie',
      value: '40 mg',
      clock: { serveur: 1, tablette: 1 },
    });
    const { merged, conflicts } = mergeChanges([next], [old]);
    expect(conflicts).toEqual([]);
    expect(merged.map((c) => c.value)).toEqual(['40 mg']);
  });

  it('posologie modifiée des deux côtés : conflit', () => {
    const tablette = change({
      key: 'a',
      kind: 'set',
      field: 'posologie',
      value: '40 mg',
      clock: { tablette: 1 },
    });
    const serveur = change({
      key: 'b',
      kind: 'set',
      field: 'posologie',
      value: '20 mg',
      nodeId: 'serveur',
      clock: { serveur: 1 },
    });
    const { merged, conflicts } = mergeChanges([tablette], [serveur]);
    expect(merged).toEqual([]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.local.value).toBe('40 mg');
    expect(conflicts[0]?.remote.value).toBe('20 mg');
  });

  it('modifications concurrentes identiques : pas de conflit', () => {
    const a = change({
      key: 'a',
      kind: 'set',
      field: 'posologie',
      value: '40 mg',
      clock: { tablette: 1 },
    });
    const b = change({
      key: 'b',
      kind: 'set',
      field: 'posologie',
      value: '40 mg',
      clock: { serveur: 1 },
    });
    const { merged, conflicts } = mergeChanges([a], [b]);
    expect(conflicts).toEqual([]);
    expect(merged).toHaveLength(1);
  });

  it('coupure de 72 h : 72 ajouts horaires de chaque côté, aucune perte', () => {
    const start = Date.parse('2026-11-01T08:00:00Z');
    const side = (node: string) =>
      Array.from({ length: 72 }, (_, h) =>
        change({
          key: `${node}-${h}`,
          nodeId: node,
          clock: { [node]: h + 1 },
          at: new Date(start + h * 3_600_000).toISOString(),
        }),
      );
    const { merged, conflicts } = mergeChanges(side('tablette'), side('serveur'));
    expect(merged).toHaveLength(144);
    expect(conflicts).toEqual([]);
  });
});
