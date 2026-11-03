import type { Filter } from '../filter.js';
import type { IdentifiedDocument, IndexedDocument } from '../types.js';

/** Index clinique en mémoire (pgvector en production). */
export class ClinicalIndex {
  private readonly documents = new Map<string, IndexedDocument>();

  /** Insère ou remplace (idempotent) un document indexé. */
  upsert(document: IndexedDocument): void {
    this.documents.set(document.documentId, document);
  }

  get(documentId: string): IndexedDocument | undefined {
    return this.documents.get(documentId);
  }

  get size(): number {
    return this.documents.size;
  }
}

/** Filtre 6a — Indexation clinique : découpe en passages et alimente l'index. */
export class IndexationFilter implements Filter<IdentifiedDocument, IndexedDocument> {
  readonly name = 'indexation';

  constructor(private readonly index: ClinicalIndex) {}

  async process(input: IdentifiedDocument): Promise<IndexedDocument> {
    const passages = input.text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const indexed = { documentId: input.reference.id, passages, entities: input.entities };
    this.index.upsert(indexed);
    return indexed;
  }
}
