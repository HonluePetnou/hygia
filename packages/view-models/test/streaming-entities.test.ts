import { describe, expect, it, vi } from 'vitest';
import { FLORENCE_ID, demoDataset } from '@hygia/fhir';
import {
  CopiloteViewModel,
  HttpCopiloteGateway,
  InMemoryCopiloteGateway,
  InMemoryIngestionGateway,
  InMemoryPatientsGateway,
  IngestionViewModel,
  SessionViewModel,
  parseSseFrames,
  splitAnswer,
} from '../src/index.js';

describe('splitAnswer', () => {
  it('sépare le texte et les marqueurs [n]', () => {
    expect(splitAnswer('Oui [1] et non [2].')).toEqual([
      { kind: 'text', text: 'Oui ' },
      { kind: 'ref', n: 1 },
      { kind: 'text', text: ' et non ' },
      { kind: 'ref', n: 2 },
      { kind: 'text', text: '.' },
    ]);
  });
});

describe('parseSseFrames', () => {
  it('décode les trames complètes et garde le reste', () => {
    const { events, rest } = parseSseFrames('event: word\ndata: {"word":"a"}\n\nevent: do');
    expect(events).toEqual([{ event: 'word', data: { word: 'a' } }]);
    expect(rest).toBe('event: do');
  });
});

describe('HttpCopiloteGateway.stream', () => {
  it('lit le flux SSE mot par mot puis les sources', async () => {
    const body = [
      'event: word\ndata: {"word":"Non"}\n\n',
      'event: word\ndata: {"word":"[1]"}\n\n',
      'event: sources\ndata: {"language":"fr","sources":[]}\n\n',
      'event: done\ndata: {}\n\n',
    ].join('');
    const fetchFn = vi.fn(async () => new Response(body)) as unknown as typeof fetch;
    const gateway = new HttpCopiloteGateway(
      'http://ia',
      () => ({ userId: 'u', role: 'medecin' }),
      fetchFn,
    );
    const words: string[] = [];
    const answer = await gateway.stream('p1', 'Quoi ?', (w) => words.push(w));
    expect(words).toEqual(['Non', '[1]']);
    expect(answer).toEqual({ answer: 'Non [1]', language: 'fr', sources: [] });
    expect(fetchFn).toHaveBeenCalledWith(
      'http://ia/copilote/p1/flux?q=Quoi%20%3F',
      expect.objectContaining({ headers: expect.objectContaining({ 'x-user-id': 'u' }) }),
    );
  });
});

describe('CopiloteViewModel (flux)', () => {
  const create = () =>
    new CopiloteViewModel(
      new InMemoryCopiloteGateway(demoDataset),
      new SessionViewModel(),
      new InMemoryPatientsGateway(demoDataset, () => '2026-10-28'),
    );

  it('affiche le périmètre, ouvre une source et signale la langue de la réponse', async () => {
    const copilote = create();
    copilote.open(FLORENCE_ID);
    await vi.waitFor(() => expect(copilote.labels.scope).toContain('Florence Ngo Bassa'));
    await copilote.ask('What did the last echocardiography show?');
    const reply = copilote.messages[1];
    expect(reply?.streaming).toBe(false);
    expect(copilote.answeredInLabel(reply!)).toBe('Answered in English');
    copilote.openSource(reply!.id, reply!.sources[0]!.n);
    expect(copilote.opened?.source.n).toBe(reply!.sources[0]!.n);
    copilote.closeSource();
    expect(copilote.opened).toBeNull();
  });

  it('ne signale pas la langue quand elle est celle de l’interface', async () => {
    const copilote = create();
    copilote.open(FLORENCE_ID);
    await copilote.ask('Quel est le dernier INR ?');
    expect(copilote.answeredInLabel(copilote.messages[1]!)).toBeNull();
  });
});

describe('IngestionViewModel (entités)', () => {
  it('valide, rejette et valide tout, sans rien enregistrer', async () => {
    const ingestion = new IngestionViewModel(
      new InMemoryIngestionGateway(),
      new SessionViewModel(),
    );
    ingestion.chooseFile({ name: 'ordonnance.png' });
    await ingestion.start();
    expect(ingestion.entityViews.length).toBeGreaterThan(2);
    expect(ingestion.entityViews.some((e) => e.lowConfidence)).toBe(true);
    expect(ingestion.pendingCount).toBe(ingestion.entities.length);

    ingestion.decide(0, 'validated');
    ingestion.decide(1, 'rejected');
    ingestion.validateAll();
    expect(ingestion.decisions[0]).toBe('validated');
    expect(ingestion.decisions[1]).toBe('rejected');
    expect(ingestion.pendingCount).toBe(0);
    expect(ingestion.chainStatus).toBe('done');
    expect(ingestion.channels).toHaveLength(4);
  });
});
