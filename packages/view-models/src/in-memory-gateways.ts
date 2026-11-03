import { createTranslator } from '@hygia/i18n';
import type { CopiloteGateway, IngestionGateway } from './gateways.js';
import { InMemoryKnowledge, type Dataset } from './in-memory-knowledge.js';
import type {
  ChosenFile,
  CopiloteAnswer,
  IngestionResult,
  IngestionStep,
  IngestionStepId,
  ExtractedEntityRow,
  WordHandler,
} from './types.js';

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Entités de l'ordonnance fictive (maquette 06). */
const DEMO_ENTITIES: ExtractedEntityRow[] = [
  { sourceText: 'Ibuprofène 400 mg : 1 cp × 3/j', kind: 'medication', normalized: 'Ibuprofène · 400 mg · 3×/j · 5 j', code: 'ATC M01AE01', confidence: 0.93 },
  { sourceText: 'Lombalgies', kind: 'diagnosis', normalized: 'Lombalgie basse', code: 'CIM-10 M54.5', confidence: 0.81 },
  { sourceText: 'Gel anti-inflammatoire', kind: 'medication', normalized: 'Kétoprofène gel (à confirmer)', code: 'ATC M02AA10', confidence: 0.58 },
  { sourceText: '28/10/26', kind: 'date', normalized: '2026-10-28', confidence: 0.99 },
];

const FRENCH_HINTS = /\b(le|la|les|quel|quelle|quels|est|sont|du|des|patient|traitement)\b/i;

/** Copilote en mémoire : ne répond qu'à partir des passages retrouvés, et les cite. */
export class InMemoryCopiloteGateway implements CopiloteGateway {
  private readonly knowledge: InMemoryKnowledge;

  constructor(dataset: Dataset) {
    this.knowledge = new InMemoryKnowledge(dataset);
  }

  async stream(patientId: string, question: string, onWord: WordHandler): Promise<CopiloteAnswer> {
    const answer = await this.ask(patientId, question);
    for (const word of answer.answer.split(/\s+/).filter((w) => w.length > 0)) {
      onWord(word);
      await tick();
    }
    return answer;
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
    const ok = this.failAt === undefined;
    return Promise.resolve({
      documentId: `doc-${file.name}`,
      steps,
      branches: { clinical: ok ? 'done' : 'pending', analytic: ok ? 'done' : 'pending' },
      entities: ok ? DEMO_ENTITIES : [],
    });
  }
}
