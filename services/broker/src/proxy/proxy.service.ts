import { request as httpRequest, type IncomingHttpHeaders, type OutgoingHttpHeaders } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { Request, Response } from 'express';

const HOP_BY_HOP = [
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'te',
  'trailer',
  'proxy-authorization',
  'proxy-authenticate',
];

/** Erreurs réseau où la requête n'a certainement pas atteint le service : rejouable même sans idempotence. */
const NOT_DELIVERED = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH']);

/** Issue d'une tentative : réponse commencée (`ok`) ou échec avant toute réponse. */
export type ForwardResult =
  | { ok: true; status: number }
  | { ok: false; reason: string; /** La requête n'a pas atteint le service. */ notDelivered: boolean };

function cleaned(headers: IncomingHttpHeaders, correlationId: string): OutgoingHttpHeaders {
  const out: OutgoingHttpHeaders = { ...headers };
  for (const h of HOP_BY_HOP) delete out[h];
  out['x-correlation-id'] = correlationId;
  return out;
}

/** Transmet une requête à un service et renvoie la réponse en flux (HTTP et SSE). */
export class ProxyService {
  constructor(private readonly timeoutMs: number) {}

  /**
   * @param target Adresse de base de l'instance.
   * @param path Chemin (avec requête) à appeler sur le service.
   * @param correlationId Identifiant propagé dans `x-correlation-id`.
   * @param body Corps déjà lu (permet de rejouer la requête) ; sinon le corps est transmis en flux.
   * @returns Résolu dès que la réponse commence, ou en échec si le service ne répond pas
   * avant le délai (rien n'a alors été écrit sur `res`, qui reste utilisable pour une autre tentative).
   */
  forward(
    req: Request,
    res: Response,
    target: URL,
    path: string,
    correlationId: string,
    body?: Buffer,
  ): Promise<ForwardResult> {
    return new Promise((resolve) => {
      const headers = cleaned(req.headers, correlationId);
      delete headers['host'];
      const send = target.protocol === 'https:' ? httpsRequest : httpRequest;
      const upstream = send(
        {
          hostname: target.hostname,
          port: target.port,
          method: req.method,
          path: `${target.pathname.replace(/\/+$/, '')}${path}`,
          headers,
        },
        (upstreamRes) => {
          clearTimeout(timer);
          res.writeHead(upstreamRes.statusCode ?? 502, cleaned(upstreamRes.headers, correlationId));
          res.flushHeaders();
          upstreamRes.pipe(res);
          upstreamRes.on('error', () => res.destroy());
          resolve({ ok: true, status: upstreamRes.statusCode ?? 502 });
        },
      );
      const timer = setTimeout(() => upstream.destroy(new Error('délai dépassé')), this.timeoutMs);
      upstream.on('error', (error: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        if (!res.headersSent) {
          resolve({ ok: false, reason: error.message, notDelivered: NOT_DELIVERED.has(error.code ?? '') });
        } else res.destroy();
      });
      res.on('close', () => {
        clearTimeout(timer);
        if (!res.writableFinished) upstream.destroy();
      });
      if (body === undefined) req.pipe(upstream);
      else upstream.end(body);
    });
  }
}
