/** Évènement Server-Sent Events décodé. */
export interface SseEvent {
  event: string;
  data: unknown;
}

/** Découpe un tampon en trames complètes ; renvoie les évènements et le reste non terminé. */
export function parseSseFrames(buffer: string): { events: SseEvent[]; rest: string } {
  const frames = buffer.split('\n\n');
  const rest = frames.pop() ?? '';
  const events: SseEvent[] = [];
  for (const frame of frames) {
    let event = 'message';
    const data: string[] = [];
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trim());
    }
    if (data.length > 0) events.push({ event, data: JSON.parse(data.join('\n')) as unknown });
  }
  return { events, rest };
}

/** Lit un corps de réponse SSE et appelle `onEvent` pour chaque évènement. */
export async function readSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SseEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    const parsed = parseSseFrames(buffer);
    buffer = parsed.rest;
    parsed.events.forEach(onEvent);
  }
}
