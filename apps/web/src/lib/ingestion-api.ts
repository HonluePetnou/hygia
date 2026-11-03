import type {
  ChosenFile,
  ExtractedEntityRow,
  IngestionBranches,
  IngestionGateway,
  IngestionResult,
  IngestionStep,
  IngestionStepId,
  IngestionStepStatus,
} from '@hygia/view-models';

/** Événement d'étape renvoyé par la route `/api/ingestion` (reflet de `StageEvent`). */
export interface ApiStageEvent {
  stage: string;
  status: 'started' | 'done' | 'failed';
  durationMs?: number;
  error?: string;
}

/** Réponse de la route `/api/ingestion`. */
export interface IngestionApiResponse {
  documentId: string;
  outcome: 'ok' | 'duplicate' | 'failed';
  events: ApiStageEvent[];
  entities: ExtractedEntityRow[];
}

/** Étape de la vue-modèle ↔ nom du filtre dans `@hygia/ingestion`. */
const STAGES: ReadonlyArray<readonly [IngestionStepId, string]> = [
  ['reception', 'reception'],
  ['ocr', 'ocr'],
  ['normalization', 'normalisation'],
  ['aiExtraction', 'extraction'],
  ['identifierDetection', 'identifiants'],
];

function statusOf(events: readonly ApiStageEvent[], stage: string): IngestionStepStatus {
  const last = events.filter((e) => e.stage === stage).at(-1);
  if (!last) return 'pending';
  if (last.status === 'started') return 'inProgress';
  return last.status === 'done' ? 'done' : 'failed';
}

/** Convertit les événements d'étape de la chaîne en résultat pour la vue-modèle. */
export function toIngestionResult(response: IngestionApiResponse): IngestionResult {
  const steps = STAGES.map(([id, stage]): IngestionStep => {
    const done = response.events.find((e) => e.stage === stage && e.status !== 'started');
    const status = statusOf(response.events, stage);
    return done?.durationMs === undefined ? { id, status } : { id, status, durationMs: done.durationMs };
  });
  const branches: IngestionBranches = {
    clinical: statusOf(response.events, 'indexation'),
    analytic: statusOf(response.events, 'pseudonymisation'),
  };
  return { documentId: response.documentId, steps, branches, entities: response.entities };
}

/** Ingestion de démonstration : envoie le fichier à la route Next.js `/api/ingestion`. */
export class ApiIngestionGateway implements IngestionGateway {
  constructor(
    private readonly url = '/api/ingestion',
    private readonly fetchFn: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  async ingest(file: ChosenFile, patientId?: string): Promise<IngestionResult> {
    const form = new FormData();
    form.append('file', file.content ?? new Blob([]), file.name);
    if (patientId) form.append('patientId', patientId);
    const response = await this.fetchFn(this.url, { method: 'POST', body: form });
    if (!response.ok) throw new Error(`POST ${this.url} : ${response.status}`);
    return toIngestionResult((await response.json()) as IngestionApiResponse);
  }
}
