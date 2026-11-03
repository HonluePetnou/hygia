/** Morceau d'une réponse : texte brut ou renvoi `[n]` vers une source. */
export type AnswerSegment = { kind: 'text'; text: string } | { kind: 'ref'; n: number };

/** Découpe une réponse en texte et marqueurs de source `[n]`. */
export function splitAnswer(text: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(/\[(\d+)\]/g)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ kind: 'text', text: text.slice(last, index) });
    segments.push({ kind: 'ref', n: Number(match[1]) });
    last = index + match[0].length;
  }
  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) });
  return segments;
}
