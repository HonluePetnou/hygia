import type { Request } from 'express';

/** Taille maximale d'un corps mis en mémoire pour être rejoué sur une autre instance (25 Mo). */
export const MAX_REPLAY_BYTES = 25 * 1024 * 1024;

/**
 * Lit le corps entier d'une requête.
 *
 * @throws RangeError si le corps dépasse `MAX_REPLAY_BYTES`.
 */
export async function readBody(req: Request): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += buffer.length;
    if (size > MAX_REPLAY_BYTES) throw new RangeError('Corps de requête trop volumineux');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}
