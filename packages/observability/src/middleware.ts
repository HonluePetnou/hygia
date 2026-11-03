import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { MetricsRegistry } from './metrics.js';

/** Ligne de journal d'une requête (jamais la requête de recherche ni le corps : données de santé). */
export interface RequestLog {
  level: 'info' | 'error';
  service: string;
  correlationId: string;
  /** Identifiant de trace W3C (`traceparent`), si le client en fournit un (compatible OpenTelemetry). */
  traceId?: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
}

/** Options de `createObservability`. */
export interface ObservabilityOptions {
  service: string;
  /** Destination du journal ; par défaut une ligne JSON sur la sortie standard. */
  log?: (line: RequestLog) => void;
  /** Horloge en ms (injectable pour les tests). */
  now?: () => number;
}

/** Fonction à brancher devant le routeur (Express, Nest ou `node:http`). */
export type ObservabilityMiddleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

const TRACEPARENT = /^[\da-f]{2}-([\da-f]{32})-[\da-f]{16}-[\da-f]{2}$/;

/**
 * Observabilité d'un service : répond à `GET /health` et `GET /metrics`, propage (ou crée)
 * `x-correlation-id`, mesure chaque réponse et journalise une ligne JSON par requête.
 * OpenTelemetry reste optionnel : l'identifiant de trace `traceparent` est repris dans le journal.
 */
export function createObservability(options: ObservabilityOptions): {
  middleware: ObservabilityMiddleware;
  registry: MetricsRegistry;
} {
  const now = options.now ?? Date.now;
  const registry = new MetricsRegistry(options.service, now);
  const log = options.log ?? ((line: RequestLog) => console.log(JSON.stringify(line)));

  const middleware: ObservabilityMiddleware = (req, res, next) => {
    const correlationId = header(req, 'x-correlation-id') ?? randomUUID();
    // Les couches suivantes (broker, proxy) relisent l'en-tête : même identifiant partout.
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    // `originalUrl` : Express retire le préfixe de montage de `url` (middleware monté sur un motif).
    const path = ((req as { originalUrl?: string }).originalUrl ?? req.url ?? '/').split('?')[0] ?? '/';
    const method = req.method ?? 'GET';
    const traceId = TRACEPARENT.exec(header(req, 'traceparent') ?? '')?.[1];
    const started = now();
    const probe = path === '/health' || path === '/metrics';
    res.on('finish', () => {
      const durationMs = now() - started;
      if (!probe) registry.record(res.statusCode, durationMs);
      log({
        level: res.statusCode >= 500 ? 'error' : 'info',
        service: options.service,
        correlationId,
        ...(traceId === undefined ? {} : { traceId }),
        method,
        path,
        status: res.statusCode,
        durationMs,
      });
    });
    if (method === 'GET' && probe) {
      const body = path === '/health' ? { status: 'ok', service: options.service } : registry.snapshot();
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(body));
      return;
    }
    next();
  };
  return { middleware, registry };
}
