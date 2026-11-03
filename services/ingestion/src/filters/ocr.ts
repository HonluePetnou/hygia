import type { Filter } from '../filter.js';
import type { OcrDocument, ReceivedDocument } from '../types.js';

/** Moteur de reconnaissance de texte (Textract en production). */
export interface OcrEngine {
  recognize(document: ReceivedDocument): Promise<string>;
}

/** Texte des documents fictifs, par nom de fichier. */
export const MOCK_OCR_TEXTS: Readonly<Record<string, string>> = {
  'ordonnance-florence.png': [
    'Dr Aïcha Nana - Cardiologie',
    'Patiente : Florence Ngo Bassa, née le 12/03/1955',
    'Tél : 06 12 34 56 78',
    'Date : 15/10/2026',
    'Lombalgies',
    'Ibuprofène 400 mg : 1 cp × 3/j pdt 5 jours',
  ].join('\n'),
};

/** Moteur factice : texte fictif connu pour les PDF/images, contenu brut pour CSV/JSON. */
export class MockOcrEngine implements OcrEngine {
  constructor(private readonly texts: Readonly<Record<string, string>> = MOCK_OCR_TEXTS) {}

  async recognize(document: ReceivedDocument): Promise<string> {
    if (document.mediaType === 'text/csv' || document.mediaType === 'application/json') {
      return new TextDecoder().decode(document.bytes);
    }
    const text = this.texts[document.fileName];
    if (text === undefined) throw new Error(`OCR : document inconnu ${document.fileName}`);
    return text;
  }
}

/** Filtre 2 — OCR. */
export class OcrFilter implements Filter<ReceivedDocument, OcrDocument> {
  readonly name = 'ocr';

  constructor(private readonly engine: OcrEngine) {}

  async process(input: ReceivedDocument): Promise<OcrDocument> {
    return { ...input, text: await this.engine.recognize(input) };
  }
}
