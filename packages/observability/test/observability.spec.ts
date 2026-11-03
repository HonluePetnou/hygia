import { createServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { MetricsRegistry, createObservability, percentile, type RequestLog } from '../src/index.js';

describe('percentile', () => {
  it('rang le plus proche, 0 sans échantillon', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 50)).toBe(50);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile([], 95)).toBe(0);
  });
});

describe('MetricsRegistry', () => {
  it('compte requêtes et erreurs 5xx, calcule p50/p95', () => {
    const registry = new MetricsRegistry('x');
    for (let i = 1; i <= 20; i += 1) registry.record(i === 20 ? 500 : 200, i * 10);
    expect(registry.snapshot()).toMatchObject({ requests: 20, errors: 1, latency: { p50Ms: 100, p95Ms: 190 } });
  });
});

describe('createObservability', () => {
  let server: Server;
  const logs: RequestLog[] = [];

  async function start(): Promise<number> {
    const { middleware } = createObservability({ service: 'demo', log: (l) => logs.push(l) });
    server = createServer((req, res) =>
      middleware(req, res, () => {
        res.statusCode = req.url?.startsWith('/boom') ? 500 : 200;
        res.end('ok');
      }),
    );
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return (server.address() as AddressInfo).port;
  }

  function get(port: number, path: string, headers: Record<string, string> = {}) {
    return new Promise<{ status: number; headers: Record<string, unknown>; body: string }>((resolve, reject) => {
      request({ port, host: '127.0.0.1', path, headers }, (res) => {
        let body = '';
        res.on('data', (c: Buffer) => (body += c.toString()));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      })
        .on('error', reject)
        .end();
    });
  }

  afterEach(() => {
    server.close();
    logs.length = 0;
  });

  it('expose /health et /metrics sans les compter', async () => {
    const port = await start();
    const health = await get(port, '/health');
    expect(JSON.parse(health.body)).toEqual({ status: 'ok', service: 'demo' });
    await get(port, '/a');
    await get(port, '/boom');
    const metrics = JSON.parse((await get(port, '/metrics')).body);
    expect(metrics).toMatchObject({ service: 'demo', requests: 2, errors: 1 });
    expect(metrics.latency.p95Ms).toBeGreaterThanOrEqual(0);
  });

  it('propage ou crée x-correlation-id et le journalise sans la requête de recherche', async () => {
    const port = await start();
    const traceparent = '00-' + 'a'.repeat(32) + '-' + 'b'.repeat(16) + '-01';
    const given = await get(port, '/patients?q=Florence', { 'x-correlation-id': 'abc-123', traceparent });
    expect(given.headers['x-correlation-id']).toBe('abc-123');
    const created = await get(port, '/a');
    expect(String(created.headers['x-correlation-id'])).toMatch(/^[\da-f-]{36}$/);
    await new Promise((r) => setTimeout(r, 20));
    expect(logs[0]).toMatchObject({ service: 'demo', correlationId: 'abc-123', path: '/patients', status: 200, traceId: 'a'.repeat(32) });
    expect(JSON.stringify(logs)).not.toContain('Florence');
  });
});
