import 'reflect-metadata';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TokenIssuer, localVerifier } from '@hygia/auth';
import request from 'supertest';
import { AppModule, BROKER_ENV } from '../src/app.module.js';
import { loadEnv, type Env } from '../src/config/env.js';
import { RateLimiter } from '../src/limit/rate-limiter.js';
import { TOKEN_VERIFIER } from '../src/proxy/broker.controller.js';


/** Faux service : renvoie son nom, le chemin reçu et l'en-tête de corrélation ; `/flux` émet du SSE. */
function startService(name: string): Promise<{ server: Server; url: string }> {
  const server = createServer((req: IncomingMessage, res) => {
    if (req.url === '/flux') {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('event: word\ndata: {"word":"bonjour"}\n\n');
      setTimeout(() => res.end('event: done\ndata: {}\n\n'), 20);
      return;
    }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ name, url: req.url, correlation: req.headers['x-correlation-id'], auth: req.headers['authorization'] }));
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })),
  );
}

describe('broker', () => {
  const servers: Server[] = [];
  let app: INestApplication;
  let issuer: TokenIssuer;
  let user: Record<string, string>;

  /** En-tête Authorization d'un jeton valide pour l'utilisateur `sub`. */
  async function tokenFor(sub: string): Promise<Record<string, string>> {
    const { token } = await issuer.issue({ sub, role: 'medecin', teams: [], emergency: [] }, new Date());
    return { authorization: `Bearer ${token}` };
  }

  async function boot(overrides: Partial<Env>, services: Record<string, string>): Promise<void> {
    const env: Env = { ...loadEnv({}), services, timeoutMs: 300, ...overrides };
    issuer = await TokenIssuer.create();
    user = await tokenFor('u1');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(BROKER_ENV)
      .useValue(env)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(localVerifier(issuer.jwks()))
      .compile();
    app = module.createNestApplication({ bodyParser: false });
    await app.init();
  }

  afterEach(async () => {
    await app.close();
    for (const s of servers.splice(0)) s.close();
  });

  async function service(name: string): Promise<string> {
    const { server, url } = await startService(name);
    servers.push(server);
    return url;
  }

  it('route /api/<service>/... vers le service désigné par son nom', async () => {
    await boot({}, { dossiers: await service('dossiers'), 'ia-clinique': await service('ia') });
    const a = await request(app.getHttpServer()).get('/api/dossiers/patients?q=fl').set(user);
    expect(a.body).toMatchObject({ name: 'dossiers', url: '/patients?q=fl' });
    const b = await request(app.getHttpServer()).get('/api/ia-clinique/copilote/x').set(user);
    expect(b.body).toMatchObject({ name: 'ia', url: '/copilote/x' });
  });

  it('renvoie 404 pour un service inconnu ou non déclaré', async () => {
    await boot({}, { dossiers: await service('dossiers') });
    expect((await request(app.getHttpServer()).get('/api/inconnu/x').set(user)).status).toBe(404);
    expect((await request(app.getHttpServer()).get('/api/audit/x').set(user)).status).toBe(404);
  });

  it('renvoie 401 sans jeton, avec un faux jeton, un jeton d’une autre clé ou des en-têtes simulés', async () => {
    await boot({}, { dossiers: await service('dossiers') });
    const get = () => request(app.getHttpServer()).get('/api/dossiers/x');
    expect((await get()).status).toBe(401);
    expect((await get().set('authorization', 'Bearer faux.jeton.ici')).status).toBe(401);
    const other = await (await TokenIssuer.create()).issue(
      { sub: 'u1', role: 'medecin', teams: [], emergency: [] },
      new Date(),
    );
    expect((await get().set('authorization', `Bearer ${other.token}`)).status).toBe(401);
    expect((await get().set({ 'x-user-id': 'u1', 'x-user-role': 'medecin' })).status).toBe(401);
  });

  it('laisse passer sans jeton seulement la connexion et la clé publique du service Identité', async () => {
    await boot({}, { identite: await service('identite') });
    const call = (path: string) => request(app.getHttpServer()).post(`/api/identite/${path}`);
    expect((await call('auth/login')).status).toBe(200);
    expect((await call('auth/mfa/verify')).status).toBe(200);
    expect((await request(app.getHttpServer()).get('/api/identite/.well-known/jwks.json')).status).toBe(200);
    expect((await call('comptes')).status).toBe(401);
    expect((await call('bris-de-glace')).status).toBe(401);
    expect((await call('auth/refresh')).status).toBe(401);
  });

  it('transmet l’en-tête Authorization au service', async () => {
    await boot({}, { dossiers: await service('dossiers') });
    const res = await request(app.getHttpServer()).get('/api/dossiers/x').set(user);
    expect(res.status).toBe(200);
    expect(res.body.auth).toBe(user['authorization']);
  });

  it('renvoie 503 si le service ne répond pas dans le délai', async () => {
    const mute = createServer(() => undefined);
    await new Promise<void>((r) => mute.listen(0, '127.0.0.1', r));
    servers.push(mute);
    await boot({ timeoutMs: 100 }, { dossiers: `http://127.0.0.1:${(mute.address() as AddressInfo).port}` });
    const res = await request(app.getHttpServer()).get('/api/dossiers/x').set(user);
    expect(res.status).toBe(503);
    expect(res.body.message).toContain('dossiers');
  });

  it('renvoie 503 si le service est injoignable', async () => {
    await boot({}, { dossiers: 'http://127.0.0.1:1' });
    expect((await request(app.getHttpServer()).get('/api/dossiers/x').set(user)).status).toBe(503);
  });

  it('propage x-correlation-id (reçu ou généré)', async () => {
    await boot({}, { dossiers: await service('dossiers') });
    const given = await request(app.getHttpServer()).get('/api/dossiers/x').set(user).set('x-correlation-id', 'abc-123');
    expect(given.headers['x-correlation-id']).toBe('abc-123');
    expect(given.body.correlation).toBe('abc-123');
    const generated = await request(app.getHttpServer()).get('/api/dossiers/x').set(user);
    expect(generated.body.correlation).toMatch(/^[0-9a-f-]{36}$/);
    expect(generated.headers['x-correlation-id']).toBe(generated.body.correlation);
  });

  it('laisse passer le flux SSE', async () => {
    await boot({}, { 'ia-clinique': await service('ia') });
    const res = await request(app.getHttpServer()).get('/api/ia-clinique/flux').set(user).buffer(true).parse((r, cb) => {
      let data = '';
      r.on('data', (c: Buffer) => (data += c.toString()));
      r.on('end', () => cb(null, data));
    });
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.body).toContain('event: word');
    expect(res.body).toContain('event: done');
  });

  it('limite le débit par utilisateur (429)', async () => {
    await boot({ rateLimit: 2 }, { dossiers: await service('dossiers') });
    const u2 = await tokenFor('u2');
    const call = (headers: Record<string, string>) => request(app.getHttpServer()).get('/api/dossiers/x').set(headers);
    expect((await call(user)).status).toBe(200);
    expect((await call(user)).status).toBe(200);
    expect((await call(user)).status).toBe(429);
    expect((await call(u2)).status).toBe(200);
  });
});

describe('RateLimiter', () => {
  it('rouvre la fenêtre après son échéance', () => {
    let t = 0;
    const limiter = new RateLimiter(1, 1000, () => t);
    expect(limiter.tryAcquire('k')).toBe(true);
    expect(limiter.tryAcquire('k')).toBe(false);
    t = 1000;
    expect(limiter.tryAcquire('k')).toBe(true);
  });
});

describe('loadEnv', () => {
  it('lit le registre depuis l’environnement et rejette une URL invalide', () => {
    expect(loadEnv({ BROKER_SERVICE_IA_CLINIQUE_URL: 'http://ia:3003' }).services).toEqual({ 'ia-clinique': 'http://ia:3003' });
    expect(loadEnv({ BROKER_SERVICE_IDENTITE_URL: 'http://id:3004/' }).jwksUrl).toBe('http://id:3004/.well-known/jwks.json');
    expect(() => loadEnv({ BROKER_JWKS_URL: 'pas une url' })).toThrow(/BROKER_JWKS_URL/);
    expect(() => loadEnv({ BROKER_SERVICE_DOSSIERS_URL: 'pas une url' })).toThrow();
    expect(() => loadEnv({ BROKER_PORT: 'x' })).toThrow();
  });
});
