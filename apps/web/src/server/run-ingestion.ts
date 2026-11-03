import { FLORENCE_ID } from '@hygia/fhir';
import { IngestionService, type ExtractedEntity, type StageEvent } from '@hygia/ingestion';
import type { ExtractedEntityRow } from '@hygia/view-models';
import type { IngestionApiResponse } from '@/lib/ingestion-api';

/** Taille maximale d'un fichier (25 Mo, comme annoncé dans l'écran d'import). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

const MEDICATION_LABELS: Readonly<Record<string, string>> = {
  M01AE01: 'Ibuprofène',
  N02BE01: 'Paracétamol',
  C09AA05: 'Ramipril',
  C03CA01: 'Furosémide',
  A10BA02: 'Metformine',
  B01AC06: 'Aspirine',
};

const DIAGNOSIS_LABELS: Readonly<Record<string, string>> = {
  'M54.5': 'Lombalgie basse',
  I10: 'Hypertension artérielle',
  'I50.9': 'Insuffisance cardiaque',
  'E11.9': 'Diabète de type 2',
};

/** Retire accents et casse sans changer la longueur du texte (pour retrouver l'original). */
const fold = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Cherche, dans les lignes d'origine, le texte tel qu'il est écrit (avec accents). */
function originalText(entity: ExtractedEntity, passages: readonly string[]): string {
  for (const passage of passages) {
    const at = fold(passage.normalize('NFC')).indexOf(entity.text);
    if (at >= 0) return passage.normalize('NFC').slice(at, at + entity.text.length);
  }
  return entity.text;
}

function normalizedValue(entity: ExtractedEntity): string {
  if (entity.kind === 'medication') return MEDICATION_LABELS[entity.code ?? ''] ?? entity.text;
  if (entity.kind === 'diagnosis') return DIAGNOSIS_LABELS[entity.code ?? ''] ?? entity.text;
  if (entity.kind === 'date') {
    const [day, month, year] = entity.text.split('/');
    return `${year}-${month}-${day}`;
  }
  return entity.text;
}

function codeLabel(entity: ExtractedEntity): string | undefined {
  if (entity.code === undefined) return undefined;
  return `${entity.kind === 'medication' ? 'ATC' : 'CIM-10'} ${entity.code}`;
}

/** Entité de la chaîne → ligne du tableau « Entités extraites — à valider ». */
export function toEntityRow(entity: ExtractedEntity, passages: readonly string[]): ExtractedEntityRow {
  const code = codeLabel(entity);
  return {
    sourceText: originalText(entity, passages),
    kind: entity.kind,
    normalized: normalizedValue(entity),
    ...(code === undefined ? {} : { code }),
    confidence: entity.confidence,
  };
}

/**
 * Fait traverser un fichier par la chaîne d'ingestion (une instance par requête : aucun
 * état partagé) et renvoie les événements d'étape et les entités à valider.
 * Rien n'est enregistré : les entités attendent la validation d'un soignant.
 */
export async function runIngestion(
  fileName: string,
  bytes: Uint8Array,
  patientId: string = FLORENCE_ID,
): Promise<IngestionApiResponse> {
  const events: StageEvent[] = [];
  const service = new IngestionService({ onEvent: (event) => events.push(event) });
  // Sans patient choisi, l'agent de tri est simulé : il propose le patient de démonstration.
  const outcome = await service.ingest({
    fileName,
    bytes,
    subject: { reference: `Patient/${patientId}` },
  });
  const documentId = `doc-${fileName}`;
  if (outcome.status !== 'ok') {
    return { documentId, outcome: outcome.status, events, entities: [] };
  }
  const { passages, entities, documentId: indexedId } = outcome.clinical;
  return {
    documentId: indexedId,
    outcome: 'ok',
    events,
    entities: entities.map((entity) => toEntityRow(entity, passages)),
  };
}
