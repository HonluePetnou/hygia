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
   * @param target Adresse de base du service.
   * @param path Chemin (avec requête) à appeler sur le service.
   * @param correlationId Identifiant propagé dans `x-correlation-id`.
   * @param onUnavailable Appelé si le service ne répond pas avant le délai (avant tout envoi).
   */
  forward(
    req: Request,
    res: Response,
    target: URL,
    path: string,
    correlationId: string,
    onUnavailable: (reason: string) => void,
  ): void {
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
      },
    );
    const timer = setTimeout(() => upstream.destroy(new Error('délai dépassé')), this.timeoutMs);
    upstream.on('error', (error) => {
      clearTimeout(timer);
      if (!res.headersSent) onUnavailable(error.message);
      else res.destroy();
    });
    res.on('close', () => {
      clearTimeout(timer);
      if (!res.writableFinished) upstream.destroy();
    });
    req.pipe(upstream);
  }
}
