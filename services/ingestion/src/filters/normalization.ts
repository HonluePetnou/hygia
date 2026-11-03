import { validateResource } from '@hygia/fhir';
import type { DocumentReference, Language } from '@hygia/types';
import type { Filter } from '../filter.js';
import type { NormalizedDocument, OcrDocument } from '../types.js';

/** Identifiant stable dérivé de l'empreinte (même contenu, même UUID). */
export function uuidFromHash(sha256: string): string {
  const h = sha256;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function detectLanguage(text: string): Language {
  const english = text.match(/\b(the|patient|echocardiography|findings|and|with)\b/gi)?.length ?? 0;
  const french = text.match(/\b(le|la|les|du|des|et|avec|née|pdt|date)\b/gi)?.length ?? 0;
  return english > french ? 'en' : 'fr';
}

function documentType(text: string, fileName: string): string {
  if (/ibuprof|cp\s*[×x]|ordonnance/i.test(text + fileName)) return 'ordonnance';
  return 'document';
}

/** Filtre 3 — Normalisation : produit un `DocumentReference` FHIR valide. */
export class NormalizationFilter implements Filter<OcrDocument, NormalizedDocument> {
  readonly name = 'normalisation';

  constructor(private readonly now: () => Date = () => new Date()) {}

  async process(input: OcrDocument): Promise<NormalizedDocument> {
    if (input.subject === undefined) throw new Error('patient du document inconnu');
    const reference: DocumentReference = {
      resourceType: 'DocumentReference',
      id: uuidFromHash(input.sha256),
      version: 1,
      subject: input.subject,
      documentType: documentType(input.text, input.fileName),
      title: input.fileName,
      language: detectLanguage(input.text),
      date: this.now().toISOString(),
      processingStatus: 'processing',
    };
    const validation = validateResource(reference);
    if (!validation.ok)
      throw new Error(`DocumentReference invalide : ${validation.errors.join(', ')}`);
    return { ...input, reference };
  }
}
