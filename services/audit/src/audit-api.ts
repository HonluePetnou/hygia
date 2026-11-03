import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { bearerToken, type TokenClaims, type TokenVerifier } from '@hygia/auth';
import { ROLES, type Role } from '@hygia/types';
import type { AuditLog } from './audit-log.js';
import type { ChainVerifier } from './chain-verifier.js';
import { toCsv } from './csv.js';
import {
  AUDIT_CATEGORIES,
  filterEvents,
  searchEvents,
  type AuditCategory,
  type AuditQuery,
  type AuditSummary,
} from './query.js';
import { AUDIT_ACTIONS, type AuditEntryInput } from './types.js';

/** Erreur HTTP portée jusqu'à la réponse. */
class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface AuditApiOptions {
  log: AuditLog;
  verifier: TokenVerifier;
  chain: ChainVerifier;
  now: () => Date;
  /** Secret des écritures des autres services (`x-internal-key`) ; sans lui, la route est fermée. */
  internalKey?: string | undefined;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function positiveInt(value: string | null, name: string): number | undefined {
  if (value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, `${name} invalide`);
  return n;
}

/**
 * API HTTP du journal : lecture seule pour l'auditeur (tout le journal) et le patient (son
 * propre dossier) ; écriture réservée aux autres services par la route interne `/internal/events`.
 */
export class AuditApi {
  constructor(private readonly options: AuditApiOptions) {}

  /** Traite une requête ; ne lève jamais. */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url ?? '/', 'http://audit.local');
      if (url.pathname === '/health') return json(res, 200, { status: 'ok' });
      if (req.method === 'POST' && url.pathname === '/internal/events') {
        return await this.append(req, res);
      }
      if (req.method !== 'GET') throw new HttpError(405, 'Méthode non autorisée');
      const user = await this.authenticate(req);
      switch (url.pathname) {
        case '/events':
          return json(res, 200, searchEvents(this.options.log.events(), this.query(user, url)));
        case '/summary':
          this.requireAuditor(user);
          return json(res, 200, this.summary());
        case '/verify':
          this.requireAuditor(user);
          return json(res, 200, this.options.chain.runNow());
        case '/export.csv':
          this.requireAuditor(user);
          return this.exportCsv(user, url, res);
        default:
          throw new HttpError(404, 'Route inconnue');
      }
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      json(res, status, { message: error instanceof HttpError ? error.message : 'Erreur interne' });
    }
  }

  private async authenticate(req: IncomingMessage): Promise<TokenClaims> {
    const token = bearerToken(req.headers.authorization);
    if (token === undefined) throw new HttpError(401, 'Jeton Bearer requis');
    let claims: TokenClaims;
    try {
      claims = await this.options.verifier.verify(token);
    } catch {
      throw new HttpError(401, 'Jeton invalide ou expiré');
    }
    if (claims.role !== 'auditeur' && claims.role !== 'patient') {
      throw new HttpError(403, `Le rôle ${claims.role} n'a pas accès au journal d'audit`);
    }
    return claims;
  }

  private requireAuditor(user: TokenClaims): void {
    if (user.role !== 'auditeur') throw new HttpError(403, 'Réservé à l’auditeur');
  }

  /** Critères de l'URL ; le patient est toujours limité à son propre dossier. */
  private query(user: TokenClaims, url: URL): AuditQuery {
    const params = url.searchParams;
    const category = params.get('categorie') ?? 'tous';
    if (!(AUDIT_CATEGORIES as readonly string[]).includes(category)) {
      throw new HttpError(400, 'categorie invalide');
    }
    const query: AuditQuery = { category: category as AuditCategory };
    const page = positiveInt(params.get('page'), 'page');
    const pageSize = positiveInt(params.get('taille'), 'taille');
    if (page !== undefined) query.page = page;
    if (pageSize !== undefined) query.pageSize = pageSize;
    const patientId = user.role === 'patient' ? user.sub : text(params.get('patient'));
    if (patientId !== undefined) query.patientId = patientId;
    for (const [param, key] of [['acteur', 'actor'], ['q', 'text'], ['du', 'from'], ['au', 'to']] as const) {
      const value = text(params.get(param));
      if (value !== undefined) query[key] = value;
    }
    return query;
  }

  private summary(): AuditSummary {
    const events = this.options.log.events();
    const day = this.options.now().toISOString().slice(0, 10);
    const today = events.filter((e) => e.timestamp.startsWith(day));
    const status = this.options.chain.status ?? this.options.chain.runNow();
    return {
      eventsToday: today.length,
      breakGlassToday: today.filter((e) => e.action === 'bris_de_glace').length,
      chainBreaks: status.result.intact ? 0 : 1,
      chainIntact: status.result.intact,
      ...(status.result.intact ? {} : { brokenAt: status.result.brokenAt }),
      verifiedAt: status.checkedAt,
      total: events.length,
      lastEntries: events.slice(-3),
    };
  }

  /** Export CSV des résultats filtrés ; l'export est lui-même journalisé. */
  private exportCsv(user: TokenClaims, url: URL, res: ServerResponse): void {
    const rows = filterEvents(this.options.log.events(), this.query(user, url));
    this.options.log.append({
      actor: user.sub,
      role: user.role,
      action: 'export',
      resourceType: 'AuditLog',
      resourceId: 'journal',
      patientId: '-',
      reason: `Export CSV (${rows.length} entrées)`,
    });
    res.writeHead(200, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="journal-audit.csv"',
    });
    res.end(toCsv(rows));
  }

  private async append(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const expected = this.options.internalKey;
    const given = req.headers['x-internal-key'];
    if (
      expected === undefined ||
      typeof given !== 'string' ||
      given.length !== expected.length ||
      !timingSafeEqual(Buffer.from(given), Buffer.from(expected))
    ) {
      throw new HttpError(401, 'Clé interne requise');
    }
    const event = this.options.log.append(parseEntry(await readJson(req)));
    json(res, 201, event);
  }
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > 64 * 1024) throw new HttpError(413, 'Corps trop volumineux');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new HttpError(400, 'JSON invalide');
  }
}

/** Valide une entrée envoyée par un autre service. */
function parseEntry(body: unknown): AuditEntryInput {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const role = b['role'];
  const action = b['action'];
  if (!ROLES.includes(role as Role)) throw new HttpError(400, 'role invalide');
  if (!(AUDIT_ACTIONS as readonly string[]).includes(action as string)) {
    throw new HttpError(400, 'action invalide');
  }
  const fields = ['actor', 'resourceType', 'resourceId', 'patientId', 'reason'] as const;
  const entry = { role: role as Role, action: action as AuditEntryInput['action'] } as AuditEntryInput;
  for (const field of fields) {
    const value = b[field];
    if (typeof value !== 'string') throw new HttpError(400, `${field} requis`);
    entry[field] = value;
  }
  return entry;
}
