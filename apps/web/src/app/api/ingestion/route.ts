import { NextResponse } from 'next/server';
import { MAX_FILE_BYTES, runIngestion } from '@/server/run-ingestion';

export const runtime = 'nodejs';

const PATIENT_ID = /^[\w-]{1,64}$/;

/**
 * `POST /api/ingestion` (démonstration) : reçoit un fichier (`file`) et un patient facultatif
 * (`patientId`), exécute `@hygia/ingestion` et renvoie les événements d'étape et les entités.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Champ « file » manquant' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Fichier trop volumineux (25 Mo max)' }, { status: 413 });
  }
  const patientId = form?.get('patientId');
  if (typeof patientId === 'string' && patientId !== '' && !PATIENT_ID.test(patientId)) {
    return NextResponse.json({ error: 'Identifiant patient invalide' }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await runIngestion(
    file.name,
    bytes,
    typeof patientId === 'string' && patientId !== '' ? patientId : undefined,
  );
  return NextResponse.json(result);
}
