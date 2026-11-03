import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { TokenClaims, TokenVerifier } from '@hygia/auth';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AuditApi,
  AuditLog,
  ChainVerifier,
  InMemoryAuditStore,
  S3ObjectLockAuditStore,
  searchEvents,
  toCsv,
  type AuditEntryInput,
  type AuditEvent,
  type S3ObjectLockOperations,
} from '../src/index.js';

const claims = (sub: string, role: TokenClaims['role']): TokenClaims => ({
  sub,
  role,
  teams: [],
  emergency: [],
  exp: 9_999_999_999,
});

const TOKENS: Record<string, TokenClaims> = {
  aud: claims('auditrice', 'auditeur'),
  doc: claims('medecin1', 'medecin'),
  pat: claims('p1', 'patient'),
};

const verifier: TokenVerifier = {
  verify: (token) => {
    const found = TOKENS[token];
    return found ? Promise.resolve(found) : Promise.reject(new Error('invalide'));
  },
};

const entry = (n: number, over: Partial<AuditEntryInput> = {}): AuditEntryInput => ({
  actor: `u${n}`,
  role: 'medecin',
  action: 'lecture',
  resourceType: 'Patient',
  resourceId: `r${n}`,
  patientId: n % 2 === 0 ? 'p1' : 'p2',
  reason: 'soins',
  ...over,
});

let clockMs = Date.parse('2026-11-03T03:00:00Z');
const now = () => new Date(clockMs);

function build(store = new InMemoryAuditStore()) {
  const log = new AuditLog(store, undefined, now);
  const alerts: number[] = [];
  const chain = new ChainVerifier(log, { chainBroken: (at) => alerts.push(at) }, now);
  const api = new AuditApi({ log, verifier, chain, now, internalKey: 'secret' });
  return { log, chain, api, alerts, store };
}

let server: Server | undefined;
afterEach(() => {
  server?.close();
  server = undefined;
  clockMs = Date.parse('2026-11-03T03:00:00Z');
});

async function start(api: AuditApi): Promise<string> {
  server = createServer((req, res) => void api.handle(req, res));
  await new Promise<void>((resolve) => server?.listen(0, resolve));
  return `http://127.0.0.1:${(server?.address() as AddressInfo).port}`;
}

const auth = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });

describe('filtres et pagination', () => {
  const log = new AuditLog(new InMemoryAuditStore(), undefined, now);
  for (let i = 0; i < 25; i += 1) log.append(entry(i));
  log.append(entry(25, { action: 'bris_de_glace' }));
  log.append(entry(26, { action: 'export' }));
  log.append(entry(27, { action: 'question_copilote' }));
  log.append(entry(28, { action: 'modification' }));

  it('filtre par catégorie', () => {
    const only = (
      category: 'lectures' | 'bris_de_glace' | 'exports' | 'copilote' | 'modifications',
    ) => searchEvents(log.events(), { category }).total;
    expect([
      only('lectures'),
      only('bris_de_glace'),
      only('exports'),
      only('copilote'),
      only('modifications'),
    ]).toEqual([25, 1, 1, 1, 1]);
  });

  it('pagine du plus récent au plus ancien', () => {
    const first = searchEvents(log.events(), { pageSize: 10 });
    const last = searchEvents(log.events(), { pageSize: 10, page: 3 });
    expect(first.total).toBe(29);
    expect(first.items[0]?.index).toBe(28);
    expect(first.items).toHaveLength(10);
    expect(last.items.map((e) => e.index)).toEqual([8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });

  it('filtre par patient et par acteur', () => {
    expect(searchEvents(log.events(), { patientId: 'p1', actor: 'u4' }).total).toBe(1);
  });
});

describe('API HTTP', () => {
  it('renvoie une page filtrée à l’auditeur', async () => {
    const { log, api } = build();
    for (let i = 0; i < 5; i += 1) log.append(entry(i));
    log.append(entry(5, { action: 'bris_de_glace' }));
    const url = await start(api);
    const res = await fetch(`${url}/events?categorie=bris_de_glace&taille=2`, auth('aud'));
    const body = (await res.json()) as { total: number; items: AuditEvent[] };
    expect([res.status, body.total, body.items[0]?.action]).toEqual([200, 1, 'bris_de_glace']);
  });

  it('expose /health et /metrics sans jeton et propage x-correlation-id', async () => {
    const { api } = build();
    const url = await start(api);
    const health = await fetch(`${url}/health`, { headers: { 'x-correlation-id': 'corr-9' } });
    expect([health.status, health.headers.get('x-correlation-id')]).toEqual([200, 'corr-9']);
    await fetch(`${url}/events`);
    const metrics = (await (await fetch(`${url}/metrics`)).json()) as {
      service: string;
      requests: number;
      errors: number;
    };
    expect(metrics).toMatchObject({ service: 'audit', requests: 1, errors: 0 });
  });

  it('refuse un médecin et une requête sans jeton', async () => {
    const url = await start(build().api);
    expect((await fetch(`${url}/events`, auth('doc'))).status).toBe(403);
    expect((await fetch(`${url}/verify`, auth('doc'))).status).toBe(403);
    expect((await fetch(`${url}/export.csv`, auth('doc'))).status).toBe(403);
    expect((await fetch(`${url}/events`)).status).toBe(401);
    expect((await fetch(`${url}/events`, auth('faux'))).status).toBe(401);
  });

  it('limite le patient à son propre dossier', async () => {
    const { log, api } = build();
    for (let i = 0; i < 6; i += 1) log.append(entry(i));
    const url = await start(api);
    const res = await fetch(`${url}/events?patient=p2`, auth('pat'));
    const body = (await res.json()) as { items: AuditEvent[] };
    expect(body.items.length).toBe(3);
    expect(body.items.every((e) => e.patientId === 'p1')).toBe(true);
    expect((await fetch(`${url}/summary`, auth('pat'))).status).toBe(403);
  });

  it('valide les paramètres', async () => {
    const url = await start(build().api);
    expect((await fetch(`${url}/events?categorie=zzz`, auth('aud'))).status).toBe(400);
    expect((await fetch(`${url}/events?page=0`, auth('aud'))).status).toBe(400);
  });

  it('exporte en CSV et journalise l’export', async () => {
    const { log, api } = build();
    log.append(entry(1, { reason: '=cmd,"x"' }));
    const url = await start(api);
    const res = await fetch(`${url}/export.csv`, auth('aud'));
    const csv = await res.text();
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(csv).toContain(`"'=cmd,""x"""`);
    expect(log.events().at(-1)?.action).toBe('export');
  });

  it('résume la journée', async () => {
    const { log, api } = build();
    log.append(entry(1));
    log.append(entry(2, { action: 'bris_de_glace' }));
    const url = await start(api);
    const summary = (await (await fetch(`${url}/summary`, auth('aud'))).json()) as Record<
      string,
      unknown
    >;
    expect(summary).toMatchObject({
      eventsToday: 2,
      breakGlassToday: 1,
      chainBreaks: 0,
      chainIntact: true,
    });
    expect((summary['lastEntries'] as unknown[]).length).toBe(2);
  });

  it('accepte les écritures internes avec la clé seulement', async () => {
    const { log, api } = build();
    const url = await start(api);
    const post = (headers: Record<string, string>, body: unknown) =>
      fetch(`${url}/internal/events`, { method: 'POST', headers, body: JSON.stringify(body) });
    expect((await post({}, entry(1))).status).toBe(401);
    expect(
      (await post({ 'x-internal-key': 'secret' }, { ...entry(1), action: 'nope' })).status,
    ).toBe(400);
    expect((await post({ 'x-internal-key': 'secret' }, entry(1))).status).toBe(201);
    expect(log.events()).toHaveLength(1);
  });
});

describe('vérification planifiée', () => {
  it('détecte et signale une rupture, une fois par jour', () => {
    const { log, chain, alerts, store } = build();
    for (let i = 0; i < 4; i += 1) log.append(entry(i));
    expect(chain.tick()?.result).toEqual({ intact: true });
    expect(chain.tick()).toBeUndefined();
    (store.all() as AuditEvent[])[2] = { ...(store.all()[2] as AuditEvent), reason: 'falsifié' };
    expect(chain.tick()).toBeUndefined();
    clockMs += 24 * 60 * 60 * 1000;
    expect(chain.tick()?.result).toEqual({ intact: false, brokenAt: 2 });
    expect(alerts).toEqual([2]);
  });

  it('la rupture apparaît dans le résumé', async () => {
    const { log, api, store } = build();
    for (let i = 0; i < 3; i += 1) log.append(entry(i));
    (store.all() as AuditEvent[])[1] = { ...(store.all()[1] as AuditEvent), actor: 'intrus' };
    const url = await start(api);
    const summary = (await (await fetch(`${url}/summary`, auth('aud'))).json()) as Record<
      string,
      unknown
    >;
    expect(summary).toMatchObject({ chainIntact: false, chainBreaks: 1 });
  });
});

class FakeS3 implements S3ObjectLockOperations {
  readonly objects = new Map<string, { body: string; retainUntil: Date }>();
  putLocked(key: string, body: string, retainUntil: Date): Promise<void> {
    if (this.objects.has(key)) return Promise.reject(new Error('WORM : objet verrouillé'));
    this.objects.set(key, { body, retainUntil });
    return Promise.resolve();
  }
  list(prefix: string): Promise<string[]> {
    return Promise.resolve([...this.objects.keys()].filter((k) => k.startsWith(prefix)).sort());
  }
  getObject(key: string): Promise<string> {
    return Promise.resolve(this.objects.get(key)?.body ?? '');
  }
}

describe('S3ObjectLockAuditStore', () => {
  it('écrit un objet verrouillé par entrée et se recharge intact', async () => {
    const s3 = new FakeS3();
    const store = await S3ObjectLockAuditStore.open(s3, now);
    const log = new AuditLog(store, undefined, now);
    for (let i = 0; i < 3; i += 1) log.append(entry(i));
    await store.flush();
    expect([...s3.objects.keys()][0]).toBe('audit/000000000000.json');
    expect([...s3.objects.values()][0]?.retainUntil.getFullYear()).toBe(2032);
    const reloaded = new AuditLog(await S3ObjectLockAuditStore.open(s3, now), undefined, now);
    expect(reloaded.events()).toHaveLength(3);
    expect(reloaded.verify()).toEqual({ intact: true });
  });

  it('signale une écriture refusée par le verrou', async () => {
    const s3 = new FakeS3();
    const store = await S3ObjectLockAuditStore.open(s3, now);
    const log = new AuditLog(store, undefined, now);
    log.append(entry(0));
    await store.flush();
    s3.objects.clear();
    s3.objects.set('audit/000000000001.json', { body: '{}', retainUntil: now() });
    log.append(entry(1));
    await expect(store.flush()).rejects.toThrow('WORM');
  });
});

describe('demandes d’exercice des droits et signalements (RF21)', () => {
  const post = (url: string, token: string, body: unknown) =>
    fetch(`${url}/rights-requests`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const listAs = async (url: string, token: string) =>
    (await (await fetch(`${url}/rights-requests`, auth(token))).json()) as {
      patientId: string;
      kind: string;
      dueAt: string;
      createdAt: string;
    }[];

  it('enregistre une rectification du patient, visible de la DPO avec une échéance à 30 jours', async () => {
    const { api } = build();
    const url = await start(api);
    const created = await post(url, 'pat', {
      kind: 'rectification',
      message: 'Date de naissance erronée',
    });
    expect(created.status).toBe(201);
    const items = await listAs(url, 'aud');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ patientId: 'p1', kind: 'rectification' });
    expect(Date.parse(items[0]?.dueAt ?? '') - Date.parse(items[0]?.createdAt ?? '')).toBe(
      30 * 86_400_000,
    );
    // La demande est aussi tracée dans le journal chaîné.
    const events = (await (await fetch(url + '/events?patient=p1', auth('aud'))).json()) as {
      items: AuditEvent[];
    };
    expect(events.items.some((e) => e.resourceType === 'DemandeDroit')).toBe(true);
  });

  it('ne montre au patient que ses propres demandes et refuse les autres rôles', async () => {
    const { api } = build();
    const url = await start(api);
    await post(url, 'pat', { kind: 'suppression' });
    expect(await listAs(url, 'pat')).toHaveLength(1);
    expect((await post(url, 'aud', { kind: 'suppression' })).status).toBe(403);
    expect((await post(url, 'doc', { kind: 'suppression' })).status).toBe(403);
    expect((await fetch(url + '/rights-requests', auth('doc'))).status).toBe(403);
  });

  it('transmet un signalement d’accès suspect, uniquement pour une entrée du journal du patient', async () => {
    const { api, log } = build();
    const url = await start(api);
    log.append(entry(2)); // index 0, patient p1
    log.append(entry(3)); // index 1, patient p2
    const own = await post(url, 'pat', {
      kind: 'signalement',
      eventIndex: 0,
      message: 'Je ne connais pas ce médecin',
    });
    expect(own.status).toBe(201);
    expect(((await own.json()) as { eventSummary: string }).eventSummary).toContain('u2');
    expect((await post(url, 'pat', { kind: 'signalement', eventIndex: 1 })).status).toBe(400);
    expect((await post(url, 'pat', { kind: 'inconnu' })).status).toBe(400);
  });
});

describe('toCsv', () => {
  it('écrit l’en-tête puis une ligne par entrée', () => {
    const log = new AuditLog(new InMemoryAuditStore(), undefined, now);
    log.append(entry(1));
    expect(toCsv(log.events()).split('\r\n')).toHaveLength(3);
  });
});
