import { createHmac } from 'node:crypto';
import type { Filter } from '../filter.js';
import type { DetectedIdentifier, IdentifiedDocument, PseudonymizedDocument } from '../types.js';

/** Clé de démonstration (remplacée par `HYGIA_PSEUDONYM_KEY` hors local). */
export const DEMO_PSEUDONYM_KEY = 'hygia-demo-pseudonym-key';

/** Lit la clé de pseudonymisation dans l'environnement. */
export function pseudonymKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  const key = env['HYGIA_PSEUDONYM_KEY'];
  return key === undefined || key === '' ? DEMO_PSEUDONYM_KEY : key;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^$()|[\]\\{}]/g, String.raw`\$&`);
}

/** Chaînes à masquer : valeur complète, puis chaque partie d'un nom. */
function sensitiveStrings(identifiers: readonly DetectedIdentifier[]): DetectedIdentifier[] {
  const all = identifiers.flatMap((id) =>
    id.kind === 'name'
      ? [
          id,
          ...id.value
            .split(/\s+/)
            .filter((p) => p.length > 2)
            .map((value) => ({ kind: 'name' as const, value })),
        ]
      : [id],
  );
  return [...new Map(all.map((id) => [id.value, id])).values()].sort(
    (a, b) => b.value.length - a.value.length,
  );
}

/** Filtre 6b — Pseudonymisation : chaque identifiant devient un jeton HMAC stable. */
export class PseudonymizationFilter implements Filter<IdentifiedDocument, PseudonymizedDocument> {
  readonly name = 'pseudonymisation';

  constructor(private readonly key: string = pseudonymKeyFromEnv()) {}

  /** Jeton stable pour une valeur : même valeur, même jeton. */
  token(kind: DetectedIdentifier['kind'], value: string): string {
    const digest = createHmac('sha256', this.key)
      .update(`${kind}:${value.toLowerCase()}`)
      .digest('hex');
    return `[${kind.toUpperCase()}_${digest.slice(0, 12)}]`;
  }

  async process(input: IdentifiedDocument): Promise<PseudonymizedDocument> {
    const tokens: string[] = [];
    const mask = (original: string): string =>
      sensitiveStrings(input.identifiers).reduce((text, id) => {
        const token = this.token(id.kind, id.value);
        const pattern = new RegExp(escapeRegExp(id.value), 'giu');
        return pattern.test(text) ? (tokens.push(token), text.replace(pattern, token)) : text;
      }, original);
    const text = mask(input.text);
    const entities = input.entities.map((entity) => ({ ...entity, text: mask(entity.text) }));
    return { documentId: input.reference.id, text, entities, tokens: [...new Set(tokens)] };
  }
}
