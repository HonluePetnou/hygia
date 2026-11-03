import 'reflect-metadata';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TokenIssuer, localVerifier } from '@hygia/auth';
import request from 'supertest';
import { AppModule, BROKER_ENV } from '../src/app.module.js';
import { loadEnv, type Env } from '../src/config/env.js';
import { CircuitBreaker } from '../src/resilience/circuit-breaker.js';
import { LatencySeries } from '../src/metrics/latency-series.js';
import { TOKEN_VERIFIER } from '../src/proxy/broker.controller.js';

/** Instance factice : répond son nom, le corps reçu et l'en-tête de panne ; compte ses appels. */
function startInstance(name: string): Promise<{ server: Server; url: string; hits: () => number }> {
  let hits = 0;
  const server = createServer((req: IncomingMessage, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      hits += 1;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ name, body: Buffer.concat(chunks).toString(), fault: req.headers['x-hygia-fault'] ?? null }));
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, hits: () => hits }),
    ),
  );
}

type Role = 'medecin' | 'analyste' | 'admin';

const DEAD = 'http://127.0.0.1:1';

describe('broker multi-instances, disjoncteur et pannes', () => {
  const servers: Server[] = [];
  let app: INestApplication;
  let issuer: TokenIssuer;

  async function as(role: Role): Promise<Record<string, string>> {
    const { token } = await issuer.issue({ sub: `${role}-1`, role, teams: [], emergency: [] }, new Date());
    return { authorization: `Bearer ${token}` };
  }

  async function boot(services: Record<string, string>, overrides: Partial<Env> = {}): Promise<void> {
    const env: Env = { ...loadEnv({}), services, timeoutMs: 500, rateLimit: 10_000, ...overrides };
    issuer = await TokenIssuer.create();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(BROKER_ENV)
      .useValue(env)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(localVerifier(issuer.jwks()))
      .compile();
    app = module.createNestApplication({ bodyParser: false });
    await app.init();
  }

  async function instance(name: string) {
    const started = await startInstance(name);
    servers.push(started.server);
    return started;
  }

  const experiment = async (id: string, action: 'start' | 'stop') =>
    request(app.getHttpServer()).post(`/api/supervision/experiments/${id}/${action}`).set(await as('admin'));

  afterEach(async () => {
    await app.close();
    for (const s of servers.splice(0)) s.close();
  });

  it('répartit la charge entre les zones a et b', async () => {
    const a = await instance('A');
    const b = await instance('B');
    await boot({ dossiers: `a=${a.url},b=${b.url}` });
    const user = await as('medecin');
    for (let i = 0; i < 6; i += 1) expect((await request(app.getHttpServer()).get('/api/dossiers/x').set(user)).status).toBe(200);
    expect(a.hits()).toBe(3);
    expect(b.hits()).toBe(3);
  });

  it('bascule vers la zone restante sans erreur côté client quand la zone a est coupée', async () => {
    const a = await instance('A');
    const b = await instance('B');
    await boot({ dossiers: `a=${a.url},b=${b.url}`, 'ia-clinique': `a=${a.url},b=${b.url}` });
    const user = await as('medecin');
    expect((await experiment('zone-cut', 'start')).status).toBe(200);
    const statuses: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app.getHttpServer()).get('/api/dossiers/patients/p1').set(user);
      statuses.push(res.status);
      expect(res.body.name).toBe('B');
    }
    expect(statuses.every((s) => s === 200)).toBe(true);
    expect(a.hits()).toBe(0);
    const view = await request(app.getHttpServer()).get('/api/supervision').set(await as('admin'));
    expect(view.body.exercise).toMatchObject({ active: true, headline: 'zone-cut', userErrors: 0 });
    expect(view.body.exercise.failovers).toBeGreaterThanOrEqual(1);
    const dossiers = view.body.services.find((s: { id: string }) => s.id === 'dossiers');
    expect(dossiers.status).toBe('degraded');
    expect(dossiers.instances).toEqual([
      expect.objectContaining({ zone: 'a', up: false }),
      expect.objectContaining({ zone: 'b', up: true }),
    ]);
    expect(view.body.latency.points.length).toBeGreaterThan(0);
    // « Arrêter l'exercice » : la zone a reprend du service dès que son disjoncteur se referme.
    const stopped = await request(app.getHttpServer()).post('/api/supervision/exercise/stop').set(await as('admin'));
    expect(stopped.body.exercise.active).toBe(false);
  });

  it('retire une instance qui ne répond plus (disjoncteur) et réessaie sur l’autre', async () => {
    const b = await instance('B');
    await boot({ dossiers: `a=${DEAD},b=${b.url}` }, { breakerThreshold: 2, breakerCooldownMs: 60_000 });
    const user = await as('medecin');
    for (let i = 0; i < 6; i += 1) {
      const res = await request(app.getHttpServer()).get('/api/dossiers/x').set(user);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('B');
    }
    const view = await request(app.getHttpServer()).get('/api/supervision').set(await as('admin'));
    const dossiers = view.body.services.find((s: { id: string }) => s.id === 'dossiers');
    expect(dossiers.instances[0]).toMatchObject({ zone: 'a', up: false });
    expect(view.body.exercise.userErrors).toBe(0);
  });

  it('rejoue une écriture (corps conservé) sur l’autre instance quand la première est injoignable', async () => {
    const b = await instance('B');
    await boot({ dossiers: `a=${DEAD},b=${b.url}` });
    const res = await request(app.getHttpServer())
      .patch('/api/dossiers/documents/d1')
      .set(await as('medecin'))
      .set('content-type', 'application/json')
      .send({ titre: 'nouveau' });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body.body)).toEqual({ titre: 'nouveau' });
  });

  it('renvoie 503 (erreur utilisateur comptée) quand toutes les instances sont arrêtées', async () => {
    const a = await instance('A');
    const b = await instance('B');
    await boot({ dossiers: `a=${a.url},b=${b.url}` });
    await experiment('zone-cut', 'start');
    await experiment('instance-stop', 'start');
    // La zone a est coupée ; on arrête aussi la zone b par l'instance de la zone b via le disjoncteur.
    const user = await as('medecin');
    expect((await request(app.getHttpServer()).get('/api/dossiers/x').set(user)).status).toBe(200);
    for (const s of servers) s.close();
    const down = await request(app.getHttpServer()).get('/api/dossiers/x').set(user);
    expect(down.status).toBe(503);
    const view = await request(app.getHttpServer()).get('/api/supervision').set(await as('admin'));
    expect(view.body.exercise.userErrors).toBeGreaterThanOrEqual(1);
  });

  it('arrête une instance précise (expérience instance-stop) puis la relance', async () => {
    const a = await instance('A');
    const b = await instance('B');
    await boot({ dossiers: `a=${a.url},b=${b.url}` }, { breakerCooldownMs: 1 });
    await experiment('instance-stop', 'start');
    const user = await as('medecin');
    for (let i = 0; i < 4; i += 1) expect((await request(app.getHttpServer()).get('/api/dossiers/x').set(user)).body.name).toBe('B');
    await experiment('instance-stop', 'stop');
    await new Promise((r) => setTimeout(r, 10));
    const names = new Set<string>();
    for (let i = 0; i < 4; i += 1) names.add((await request(app.getHttpServer()).get('/api/dossiers/x').set(user)).body.name);
    expect(names).toEqual(new Set(['A', 'B']));
  });

  it('injecte de la latence sur le service ia-clinique', async () => {
    const ia = await instance('ia');
    await boot({ 'ia-clinique': ia.url });
    await experiment('latency', 'start');
    const t0 = Date.now();
    expect((await request(app.getHttpServer()).get('/api/ia-clinique/x').set(await as('medecin'))).status).toBe(200);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(790);
  });

  it('signale le modèle de langage indisponible à ia-clinique, sans se fier au client', async () => {
    const ia = await instance('ia');
    await boot({ 'ia-clinique': ia.url });
    const user = await as('medecin');
    const get = () => request(app.getHttpServer()).get('/api/ia-clinique/x').set(user);
    expect((await get().set('x-hygia-fault', 'llm-unavailable')).body.fault).toBeNull();
    await experiment('llm-down', 'start');
    expect((await get()).body.fault).toBe('llm-unavailable');
    await experiment('llm-down', 'stop');
    expect((await get()).body.fault).toBeNull();
  });

  it('réserve la supervision au rôle admin', async () => {
    await boot({});
    const server = app.getHttpServer();
    expect((await request(server).get('/api/supervision')).status).toBe(401);
    expect((await request(server).get('/api/supervision').set(await as('medecin'))).status).toBe(403);
    expect((await request(server).post('/api/supervision/experiments/zone-cut/start').set(await as('analyste'))).status).toBe(403);
    expect((await experiment('inconnue', 'start')).status).toBe(404);
  });

  it('expose /health et /metrics', async () => {
    const a = await instance('A');
    await boot({ dossiers: a.url });
    await request(app.getHttpServer()).get('/api/dossiers/x').set(await as('medecin'));
    expect((await request(app.getHttpServer()).get('/health')).body).toEqual({ status: 'ok', service: 'broker' });
    const metrics = await request(app.getHttpServer()).get('/metrics');
    expect(metrics.body).toMatchObject({ service: 'broker', requests: 1, errors: 0 });
  });
});

describe('CircuitBreaker', () => {
  it('s’ouvre après le seuil, passe en semi-ouvert après le délai, se referme au succès', () => {
    let t = 0;
    const breaker = new CircuitBreaker(2, 1000, () => t);
    breaker.onFailure();
    expect(breaker.state).toBe('closed');
    breaker.onFailure();
    expect(breaker.state).toBe('open');
    expect(breaker.allows()).toBe(false);
    t = 1000;
    expect(breaker.state).toBe('half-open');
    breaker.onFailure();
    expect(breaker.state).toBe('open');
    t = 2000;
    breaker.onSuccess();
    expect(breaker.state).toBe('closed');
  });
});

describe('LatencySeries', () => {
  it('calcule un p95 par tranche et oublie les tranches anciennes', () => {
    let t = 0;
    const series = new LatencySeries(1000, 2, () => t);
    for (const ms of [10, 20, 400]) series.record(ms);
    t = 1000;
    series.record(50);
    expect(series.points().map((p) => p.p95Ms)).toEqual([400, 50]);
    t = 3000;
    series.record(5);
    expect(series.points().map((p) => p.p95Ms)).toEqual([5]);
  });
});
