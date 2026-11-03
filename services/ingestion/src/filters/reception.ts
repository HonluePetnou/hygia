import { createHash } from 'node:crypto';
import type { Filter } from '../filter.js';
import type { MediaType, RawDocument, ReceivedDocument } from '../types.js';

const BY_EXTENSION: Readonly<Record<string, MediaType>> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  csv: 'text/csv',
  json: 'application/json',
};

/** Empreinte SHA-256 hexadécimale. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Détecte le type de média par extension ; `undefined` si non accepté. */
export function detectMediaType(fileName: string): MediaType | undefined {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return BY_EXTENSION[extension];
}

function startsWith(bytes: Uint8Array, text: string): boolean {
  return text.split('').every((char, i) => bytes[i] === char.charCodeAt(0));
}

/**
 * Filtre 1 — Réception : vérifie le type (PDF, image, CSV, JSON), calcule l'empreinte et
 * signale les doublons (même contenu reçu plusieurs fois : traité une seule fois).
 */
export class ReceptionFilter implements Filter<RawDocument, ReceivedDocument> {
  readonly name = 'reception';

  constructor(private readonly seen: Set<string> = new Set()) {}

  async process(input: RawDocument): Promise<ReceivedDocument> {
    const mediaType = detectMediaType(input.fileName);
    if (mediaType === undefined) {
      throw new Error(`type de document non accepté : ${input.fileName}`);
    }
    if (input.bytes.length === 0) throw new Error('document vide');
    if (mediaType === 'application/pdf' && !startsWith(input.bytes, '%PDF')) {
      throw new Error('contenu non conforme au type PDF');
    }
    const sha256 = sha256Hex(input.bytes);
    const duplicate = this.seen.has(sha256);
    this.seen.add(sha256);
    const received: ReceivedDocument = { ...input, sha256, mediaType, duplicate };
    return received;
  }
}
