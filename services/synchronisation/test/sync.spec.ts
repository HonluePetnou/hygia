import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuditLog } from '@hygia/audit';
import type { Change } from '@hygia/sync-core';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { TOKEN_VERIFIER } from '../src/auth/jwt-auth.guard.js';
import { CLOCK } from '../src/sync/conflict.service.js';
import { AUDIT_LOG, SyncService } from '../src/sync/sync.service.js';

const NOW = new Date('2026-11-03T10:00:00Z');
const DOSSIER = 'res-dossier-1';
const PATIENT = 'patient-1';

const change = (over: Partial<Change> & Pick<Change, 'key'>): Change => ({
  resourceId: DOSSIER,
  patientId: PATIENT,
  kind: 'add',
  field: 'observations',
  value: over.key,
  clock: {},
  nodeId: 'tablette',
  at: NOW.toISOString(),
  ...over,
});

describe('service Synchronisation', () => {
  let app: INestApplication;
  let role: string;
  let audit: AuditLog;
  let service: SyncService;

  beforeEach(async () => {
    role = 'medecin';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLOCK)
      .useValue(() => NOW)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue({ verify: async () => ({ sub: 'dr-1', role, teams: [], emergency: [] }) })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    audit = app.get(AUDIT_LOG);
    service = app.get(SyncService);
  });

  afterEach(async () => {
    await app.close();
  });

  const auth = { authorization: 'Bearer test' };
  const push = (body: object) => request(app.getHttpServer()).post('/sync').set(auth).send(body);
  const tablette = (changes: Change[], clocks = {}) => ({ nodeId: 'tablette', changes, clocks });

  it('fusionne automatiquement 6 ajouts de la tablette', async () => {
    const adds = Array.from({ length: 6 }, (_, n) =>
      change({ key: `obs-${n}`, clock: { tablette: n + 1 } }),
    );
    const res = await push(tablette(adds)).expect(200);
    expect(res.body.merged).toHaveLength(6);
    expect(res.body.conflicts).toEqual([]);
    expect(res.body.duplicates).toBe(0);
    expect(res.body.clocks[DOSSIER]).toEqual({ tablette: 6 });
    expect(audit.events()).toHaveLength(1);
  });

  it('renvoie à la tablette les ajouts du serveur qu’elle ne connaît pas', async () => {
    service.recordServerChange(change({ key: 's-1', nodeId: 'serveur', clock: { serveur: 1 } }));
    const res = await push(tablette([change({ key: 't-1', clock: { tablette: 1 } })])).expect(200);
    expect(res.body.remote.map((c: Change) => c.key)).toEqual(['s-1']);
    const again = await push(tablette([], { [DOSSIER]: { serveur: 1, tablette: 1 } })).expect(200);
    expect(again.body.remote).toEqual([]);
  });

  describe('posologie du furosémide : 40 mg (tablette) contre 20 mg (serveur)', () => {
    const serveur = change({
      key: 's-poso',
      kind: 'set',
      field: 'posologie',
      value: '20 mg',
      nodeId: 'serveur',
      clock: { serveur: 1 },
    });
    const local = change({
      key: 't-poso',
      kind: 'set',
      field: 'posologie',
      value: '40 mg',
      clock: { tablette: 1 },
    });

    it('détecte le conflit et garde la version du serveur en attendant', async () => {
      service.recordServerChange(serveur);
      const res = await push(tablette([local])).expect(200);
      expect(res.body.merged).toEqual([]);
      expect(res.body.conflicts).toHaveLength(1);
      expect(res.body.conflicts[0]).toMatchObject({ field: 'posologie', status: 'open' });
      expect(res.body.conflicts[0].local.value).toBe('40 mg');
      expect(res.body.conflicts[0].remote.value).toBe('20 mg');
    });

    it('un lot rejoué ne crée ni doublon ni second conflit', async () => {
      service.recordServerChange(serveur);
      const batch = tablette([local, change({ key: 'obs-1', clock: { tablette: 2 } })]);
      await push(batch).expect(200);
      const replay = await push(batch).expect(200);
      expect(replay.body.duplicates).toBe(2);
      expect(replay.body.merged).toEqual([]);
      expect(replay.body.conflicts).toHaveLength(1);
      const all = await request(app.getHttpServer()).get('/sync/conflits').set(auth).expect(200);
      expect(all.body).toHaveLength(1);
      expect(audit.events()).toHaveLength(1);
    });

    it('arbitrage : choix appliqué, tracé dans l’audit, repris par les terminaux', async () => {
      service.recordServerChange(serveur);
      const { body } = await push(tablette([local])).expect(200);
      const id = body.conflicts[0].id as string;
      const res = await request(app.getHttpServer())
        .post(`/sync/conflits/${id}/arbitrage`)
        .set(auth)
        .send({ choice: 'local' })
        .expect(200);
      expect(res.body.status).toBe('resolved');
      expect(res.body.resolution).toMatchObject({ choice: 'local', value: '40 mg', by: 'dr-1' });
      const last = audit.events().at(-1);
      expect(last).toMatchObject({
        actor: 'dr-1',
        action: 'modification',
        resourceType: 'ConflitSynchronisation',
        patientId: PATIENT,
      });
      expect(audit.verify()).toEqual({ intact: true });

      const next = await push(tablette([], { [DOSSIER]: { tablette: 1 } })).expect(200);
      expect(next.body.conflicts).toEqual([]);
      expect(next.body.remote).toHaveLength(1);
      expect(next.body.remote[0]).toMatchObject({ value: '40 mg', nodeId: 'serveur' });
      await request(app.getHttpServer())
        .post(`/sync/conflits/${id}/arbitrage`)
        .set(auth)
        .send({ choice: 'remote' })
        .expect(409);
    });

    it('refuse un choix invalide, un conflit inconnu et un non-soignant', async () => {
      service.recordServerChange(serveur);
      const { body } = await push(tablette([local])).expect(200);
      const url = `/sync/conflits/${body.conflicts[0].id}/arbitrage`;
      await request(app.getHttpServer()).post(url).set(auth).send({ choice: 'x' }).expect(400);
      await request(app.getHttpServer()).post(url).set(auth).send({ choice: 'manual' }).expect(400);
      await request(app.getHttpServer())
        .post('/sync/conflits/inconnu/arbitrage')
        .set(auth)
        .send({ choice: 'local' })
        .expect(404);
      role = 'administratif';
      await request(app.getHttpServer()).post(url).set(auth).send({ choice: 'local' }).expect(403);
      await push(tablette([])).expect(403);
    });
  });

  it('coupure de 72 h : 72 changements de la tablette + 72 du serveur, sans perte ni doublon', async () => {
    const start = Date.parse('2026-11-01T08:00:00Z');
    const at = (h: number) => new Date(start + h * 3_600_000).toISOString();
    for (let h = 0; h < 72; h += 1) {
      service.recordServerChange(
        change({ key: `s-${h}`, nodeId: 'serveur', clock: { serveur: h + 1 }, at: at(h) }),
      );
    }
    const offline = Array.from({ length: 72 }, (_, h) =>
      change({ key: `t-${h}`, clock: { tablette: h + 1 }, at: at(h) }),
    );
    const res = await push(tablette(offline)).expect(200);
    expect(res.body.merged).toHaveLength(72);
    expect(res.body.remote).toHaveLength(72);
    expect(res.body.conflicts).toEqual([]);
    const replay = await push(tablette(offline)).expect(200);
    expect(replay.body.duplicates).toBe(72);
    expect(replay.body.merged).toEqual([]);
    expect(replay.body.clocks[DOSSIER]).toEqual({ serveur: 72, tablette: 72 });
  });

  it('rejette un lot mal formé', async () => {
    await push({ nodeId: 'tablette', changes: [{ key: 'x' }] }).expect(400);
    await push({ changes: [] }).expect(400);
  });
});
