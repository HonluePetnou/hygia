import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Coding } from '@hygia/types';
import type { ConsultationDraft } from '../model/consultation-draft.js';

/** Taille maximale de l'audio décodé (≈ 20 min de m4a). */
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

/** Corps de `POST /scribe/sessions/:id/audio`. */
export class AudioDto {
  @ApiProperty({ description: 'Audio encodé en base64' }) audioBase64!: string;
  @ApiPropertyOptional({ description: 'Durée de l’enregistrement en secondes' })
  durationSeconds?: number;
}

/** Corps de `POST /scribe/sessions/:id/validation`. */
export class ValidationDto {
  @ApiPropertyOptional({ description: 'Brouillon corrigé par le médecin (celui du serveur sinon)' })
  draft?: unknown;
}

function obj(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException(`${name} doit être un objet`);
  }
  return value as Record<string, unknown>;
}

function str(source: Record<string, unknown>, key: string, allowEmpty = false): string {
  const value = source[key];
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) {
    throw new BadRequestException(`${key} doit être un texte${allowEmpty ? '' : ' non vide'}`);
  }
  return value;
}

function num(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BadRequestException(`${key} doit être un nombre`);
  }
  return value;
}

function list(source: Record<string, unknown>, key: string): unknown[] {
  const value = source[key];
  if (!Array.isArray(value) || value.length > 50) {
    throw new BadRequestException(`${key} doit être une liste de 50 éléments au plus`);
  }
  return value;
}

function coding(raw: unknown): Coding {
  const s = obj(raw, 'code');
  return { system: str(s, 'system'), code: str(s, 'code'), display: str(s, 'display') };
}

/** Décode et borne l'audio ; 400 si vide, mal encodé ou trop gros. */
export function parseAudio(body: unknown): { audio: Uint8Array; durationSeconds?: number } {
  const source = obj(body, 'corps');
  const encoded = str(source, 'audioBase64');
  if (encoded.length > Math.ceil((MAX_AUDIO_BYTES * 4) / 3) + 4 || !/^[A-Za-z0-9+/=\s]+$/.test(encoded)) {
    throw new BadRequestException('audioBase64 invalide ou trop volumineux');
  }
  const audio = new Uint8Array(Buffer.from(encoded, 'base64'));
  if (audio.byteLength === 0) throw new BadRequestException('Audio vide');
  const duration = source['durationSeconds'];
  if (duration === undefined) return { audio };
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) {
    throw new BadRequestException('durationSeconds doit être un nombre positif');
  }
  return { audio, durationSeconds: duration };
}

/** Valide un brouillon corrigé par le médecin. */
export function parseDraft(raw: unknown): ConsultationDraft {
  const s = obj(raw, 'draft');
  return {
    motif: str(s, 'motif', true),
    examen: str(s, 'examen', true),
    observations: list(s, 'observations').map((item) => {
      const o = obj(item, 'observation');
      return { code: coding(o['code']), value: num(o, 'value'), unit: str(o, 'unit') };
    }),
    diagnostics: list(s, 'diagnostics').map(coding),
    prescriptions: list(s, 'prescriptions').map((item) => {
      const p = obj(item, 'prescription');
      const note = p['note'];
      return {
        medication: coding(p['medication']),
        doseValue: num(p, 'doseValue'),
        doseUnit: str(p, 'doseUnit'),
        timesPerDay: num(p, 'timesPerDay'),
        ...(typeof note === 'string' && note !== '' ? { note } : {}),
      };
    }),
  };
}
