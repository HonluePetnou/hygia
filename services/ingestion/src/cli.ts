import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { FLORENCE_ID } from '@hygia/fhir';
import { IngestionService } from './ingestion-service.js';

async function main(): Promise<void> {
  const path = process.argv[2];
  if (path === undefined) {
    console.error('usage : pnpm --filter ingestion ingest <fichier>');
    process.exitCode = 2;
    return;
  }
  const service = new IngestionService({
    onEvent: (e) =>
      console.log(
        `[${e.status}] ${e.stage}${e.durationMs === undefined ? '' : ` (${e.durationMs.toFixed(1)} ms)`}${e.error === undefined ? '' : ` : ${e.error}`}`,
      ),
  });
  const bytes = new Uint8Array(await readFile(path));
  const subject = { reference: `Patient/${FLORENCE_ID}`, display: 'Florence Ngo Bassa' };
  const outcome = await service.ingest({ fileName: basename(path), bytes, subject });
  console.log(JSON.stringify(outcome, null, 2));
  if (outcome.status === 'failed') process.exitCode = 1;
}

await main();
