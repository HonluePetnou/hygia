import { FLORENCE_ID } from '@hygia/fhir';
import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/ingestion/route';
import { toIngestionResult, type IngestionApiResponse } from '@/lib/ingestion-api';
import { runIngestion } from '@/server/run-ingestion';

const stages = (response: IngestionApiResponse) =>
  response.events.filter((e) => e.status === 'done').map((e) => e.stage);

describe('route /api/ingestion', () => {
  it('renvoie les événements d’étape et les entités de l’ordonnance fictive', async () => {
    const response = await runIngestion('ordonnance-florence.png', new Uint8Array([1]), FLORENCE_ID);
    expect(response.outcome).toBe('ok');
    expect(stages(response)).toEqual([
      'reception',
      'ocr',
      'normalisation',
      'extraction',
      'identifiants',
      'indexation',
      'pseudonymisation',
    ]);
    const result = toIngestionResult(response);
    expect(result.steps.map((s) => s.status)).toEqual(Array(5).fill('done'));
    expect(result.branches).toEqual({ clinical: 'done', analytic: 'done' });
    expect(result.entities.find((e) => e.code === 'ATC M01AE01')).toMatchObject({
      kind: 'medication',
      normalized: 'Ibuprofène',
    });
  });

  it('signale l’étape en échec pour un document inconnu', async () => {
    const response = await runIngestion('inconnu.png', new Uint8Array([1]), FLORENCE_ID);
    expect(response.outcome).toBe('failed');
    const result = toIngestionResult(response);
    expect(result.steps.map((s) => s.status)).toEqual([
      'done',
      'failed',
      'pending',
      'pending',
      'pending',
    ]);
  });

  it('refuse une requête sans fichier', async () => {
    const answer = await POST(new Request('http://localhost/api/ingestion', { method: 'POST', body: new FormData() }));
    expect(answer.status).toBe(400);
  });
});
