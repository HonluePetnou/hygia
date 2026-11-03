import { InMemoryPipe } from './filter.js';
import { ExtractionFilter } from './filters/extraction.js';
import { IdentifierDetectionFilter } from './filters/identifiers.js';
import { ClinicalIndex, IndexationFilter } from './filters/indexation.js';
import { NormalizationFilter } from './filters/normalization.js';
import { MockOcrEngine, OcrFilter, type OcrEngine } from './filters/ocr.js';
import { PseudonymizationFilter, pseudonymKeyFromEnv } from './filters/pseudonymization.js';
import { ReceptionFilter } from './filters/reception.js';
import { DeadLetterQueue, Pipeline, type StageEvent } from './pipeline.js';
import type {
  IdentifiedDocument,
  IndexedDocument,
  PseudonymizedDocument,
  RawDocument,
} from './types.js';

/** Options d'assemblage (toutes facultatives : valeurs locales par défaut). */
export interface IngestionOptions {
  ocr?: OcrEngine;
  pseudonymKey?: string;
  onEvent?: (event: StageEvent) => void;
  now?: () => Date;
}

/** Résultat de l'ingestion d'un document. */
export type IngestionOutcome =
  | { status: 'ok'; clinical: IndexedDocument; analytic: PseudonymizedDocument }
  | { status: 'duplicate' }
  | { status: 'failed'; stage: string; error: string };

/**
 * Assemble la chaîne : réception → OCR → normalisation → extraction → identifiants, puis
 * deux branches reliées par des tubes : 6a clinique et 6b analytique.
 */
export class IngestionService {
  readonly deadLetters = new DeadLetterQueue();
  readonly clinicalIndex = new ClinicalIndex();
  readonly events: StageEvent[] = [];
  private readonly main: Pipeline<RawDocument, IdentifiedDocument>;
  private readonly clinical: Pipeline<IdentifiedDocument, IndexedDocument>;
  private readonly analytic: Pipeline<IdentifiedDocument, PseudonymizedDocument>;

  constructor(options: IngestionOptions = {}) {
    const onEvent = (event: StageEvent): void => {
      this.events.push(event);
      options.onEvent?.(event);
    };
    const isDuplicate = (value: unknown): boolean =>
      (value as { duplicate?: boolean }).duplicate === true;
    this.main = Pipeline.create<RawDocument>(this.deadLetters, onEvent, isDuplicate)
      .then(new ReceptionFilter())
      .then(new OcrFilter(options.ocr ?? new MockOcrEngine()))
      .then(new NormalizationFilter(options.now))
      .then(new ExtractionFilter())
      .then(new IdentifierDetectionFilter());
    this.clinical = Pipeline.create<IdentifiedDocument>(this.deadLetters, onEvent).then(
      new IndexationFilter(this.clinicalIndex),
    );
    this.analytic = Pipeline.create<IdentifiedDocument>(this.deadLetters, onEvent).then(
      new PseudonymizationFilter(options.pseudonymKey ?? pseudonymKeyFromEnv()),
    );
  }

  /** Fait traverser un document par la chaîne complète. */
  async ingest(document: RawDocument): Promise<IngestionOutcome> {
    const result = await this.main.run(document);
    if (result.status === 'failed') {
      return { status: 'failed', stage: result.deadLetter.stage, error: result.deadLetter.error };
    }
    if (result.status === 'skipped') return { status: 'duplicate' };
    return this.runBranches(result.output);
  }

  private async runBranches(identified: IdentifiedDocument): Promise<IngestionOutcome> {
    const toClinical = new InMemoryPipe<IdentifiedDocument>();
    const toAnalytic = new InMemoryPipe<IdentifiedDocument>();
    await Promise.all([toClinical.send(identified), toAnalytic.send(identified)]);
    const clinical = await this.clinical.run((await toClinical.receive()) as IdentifiedDocument);
    const analytic = await this.analytic.run((await toAnalytic.receive()) as IdentifiedDocument);
    if (clinical.status !== 'ok') {
      return { status: 'failed', stage: 'indexation', error: 'branche clinique en échec' };
    }
    if (analytic.status !== 'ok') {
      return { status: 'failed', stage: 'pseudonymisation', error: 'branche analytique en échec' };
    }
    return { status: 'ok', clinical: clinical.output, analytic: analytic.output };
  }
}
