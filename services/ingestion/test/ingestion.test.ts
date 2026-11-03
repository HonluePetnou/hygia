import { describe, expect, it } from 'vitest';
import { FLORENCE_ID, validateResource } from '@hygia/fhir';
import {
  IngestionService,
  MOCK_OCR_TEXTS,
  NormalizationFilter,
  sha256Hex,
  type RawDocument,
} from '../src/index.js';

const subject = { reference: `Patient/${FLORENCE_ID}`, display: 'Florence Ngo Bassa' };

const ordonnance = (): RawDocument => ({
  fileName: 'ordonnance-florence.png',
  bytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3]),
  subject,
});

describe("chaîne d'ingestion", () => {
  it("traite l'ordonnance de Florence de bout en bout", async () => {
    const service = new IngestionService();
    const outcome = await service.ingest(ordonnance());
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;

    const { entities } = outcome.clinical;
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'medication', code: 'M01AE01' }),
    );
    expect(entities).toContainEqual(expect.objectContaining({ kind: 'diagnosis', code: 'M54.5' }));
    expect(entities.some((e) => e.kind === 'posology' && e.text.includes('3/j'))).toBe(true);
    expect(entities.every((e) => e.confidence > 0 && e.confidence <= 1)).toBe(true);
    expect(service.clinicalIndex.size).toBe(1);

    const started = service.events.filter((e) => e.status === 'started').map((e) => e.stage);
    expect(started).toEqual([
      'reception',
      'ocr',
      'normalisation',
      'extraction',
      'identifiants',
      'indexation',
      'pseudonymisation',
    ]);
    expect(
      service.events.filter((e) => e.status === 'done').every((e) => e.durationMs !== undefined),
    ).toBe(true);
  });

  it('produit un DocumentReference FHIR valide', async () => {
    const normalized = await new NormalizationFilter().process({
      sha256: sha256Hex(ordonnance().bytes),
      fileName: 'ordonnance-florence.png',
      mediaType: 'image/png',
      bytes: ordonnance().bytes,
      subject,
      duplicate: false,
      text: MOCK_OCR_TEXTS['ordonnance-florence.png'] ?? '',
    });
    expect(validateResource(normalized.reference)).toEqual({ ok: true });
    expect(normalized.reference.documentType).toBe('ordonnance');
    expect(normalized.reference.language).toBe('fr');
  });

  it("ne traite qu'une fois un document reçu deux fois", async () => {
    const service = new IngestionService();
    expect((await service.ingest(ordonnance())).status).toBe('ok');
    expect((await service.ingest(ordonnance())).status).toBe('duplicate');
    expect(service.clinicalIndex.size).toBe(1);
    expect(service.deadLetters.items).toHaveLength(0);
  });

  it('ne laisse aucun identifiant en clair dans la sortie analytique', async () => {
    const service = new IngestionService();
    const outcome = await service.ingest(ordonnance());
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    const output = JSON.stringify(outcome.analytic);
    for (const secret of [
      'Florence',
      'Ngo Bassa',
      'Nana',
      'Aïcha',
      '06 12 34 56 78',
      '12/03/1955',
      '15/10/2026',
    ]) {
      expect(output).not.toContain(secret);
    }
    expect(outcome.analytic.tokens.length).toBeGreaterThan(0);
    expect(output).toContain('Ibuprofène'.toLowerCase().normalize('NFD').replace(/\p{M}/gu, ''));
  });

  it('produit des jetons stables pour une même clé', async () => {
    const a = await new IngestionService({ pseudonymKey: 'k1' }).ingest(ordonnance());
    const b = await new IngestionService({ pseudonymKey: 'k1' }).ingest(ordonnance());
    const c = await new IngestionService({ pseudonymKey: 'k2' }).ingest(ordonnance());
    if (a.status !== 'ok' || b.status !== 'ok' || c.status !== 'ok') throw new Error('échec');
    expect(a.analytic.text).toBe(b.analytic.text);
    expect(a.analytic.text).not.toBe(c.analytic.text);
  });

  it('envoie un document invalide en lettres mortes', async () => {
    const service = new IngestionService();
    const outcome = await service.ingest({
      fileName: 'virus.exe',
      bytes: new Uint8Array([1, 2, 3]),
      subject,
    });
    expect(outcome).toMatchObject({ status: 'failed', stage: 'reception' });
    expect(service.deadLetters.items).toHaveLength(1);
    expect(service.events.at(-1)).toMatchObject({ stage: 'reception', status: 'failed' });
  });
});
