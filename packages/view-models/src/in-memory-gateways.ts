import { createTranslator } from '@hygia/i18n';
import type { CopiloteGateway, IngestionGateway } from './gateways.js';
import { InMemoryKnowledge, type Dataset } from './in-memory-knowledge.js';
import type {
  ChosenFile,
  CopiloteAnswer,
  IngestionResult,
  IngestionStep,
  IngestionStepId,
} from './types.js';

const FRENCH_HINTS = /\b(le|la|les|quel|quelle|quels|est|sont|du|des|patient|traitement)\b/i;

/** Copilote en mémoire : ne répond qu'à partir des passages retrouvés, et les cite. */
export class InMemoryCopiloteGateway implements CopiloteGateway {
  private readonly knowledge: InMemoryKnowledge;

  constructor(dataset: Dataset) {
    this.knowledge = new InMemoryKnowledge(dataset);
  }

  ask(patientId: string, question: string): Promise<CopiloteAnswer> {
    const language = FRENCH_HINTS.test(question) ? 'fr' : 'en';
    const t = createTranslator(language);
    const sources = this.knowledge.search(patientId, question, 3);
    if (sources.length === 0) {
      return Promise.resolve({ answer: t('copilot.noSourceAnswer'), language, sources });
    }
    const lines = sources.map((s) => `${s.extrait} (${s.date}) [${s.n}]`);
    return Promise.resolve({
      answer: `${t('copilot.answerIntro')} ${lines.join(' ; ')}`,
      language,
      sources,
    });
  }
}

/** Étapes et durées simulées de la chaîne d'ingestion. */
const STEP_DURATIONS: ReadonlyArray<readonly [IngestionStepId, number]> = [
  ['reception', 12],
  ['ocr', 340],
  ['normalization', 45],
  ['aiExtraction', 210],
  ['identifierDetection', 30],
];

/** Ingestion en mémoire : toutes les étapes réussissent, sauf si `failAt` est précisé. */
export class InMemoryIngestionGateway implements IngestionGateway {
  constructor(private readonly failAt?: IngestionStepId) {}

  ingest(file: ChosenFile): Promise<IngestionResult> {
    let failed = false;
    const steps = STEP_DURATIONS.map(([id, durationMs]): IngestionStep => {
      if (failed) return { id, status: 'pending' };
      if (id === this.failAt) {
        failed = true;
        return { id, status: 'failed', durationMs };
      }
      return { id, status: 'done', durationMs };
    });
    return Promise.resolve({ documentId: `doc-${file.name}`, steps });
  }
}
