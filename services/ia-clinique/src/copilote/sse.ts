import type { Response } from 'express';
import type { CopiloteAnswer } from './copilote.types.js';

/** Jeton d'injection du délai (ms) entre deux mots du flux. */
export const WORD_DELAY_MS = Symbol('WORD_DELAY_MS');

const pause = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

const frame = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/**
 * Envoie la réponse en Server-Sent Events : un évènement `word` par mot, puis `sources`,
 * puis `done`. S'interrompt si le client se déconnecte.
 */
export async function streamAnswer(
  response: Response,
  result: CopiloteAnswer,
  delayMs: number,
): Promise<void> {
  response.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  response.flushHeaders();
  let closed = false;
  response.on('close', () => {
    closed = true;
  });
  for (const word of result.answer.split(/\s+/).filter((w) => w.length > 0)) {
    if (closed) return;
    response.write(frame('word', { word }));
    await pause(delayMs);
  }
  if (closed) return;
  response.write(frame('sources', { language: result.language, sources: result.sources }));
  response.write(frame('done', {}));
  response.end();
}
