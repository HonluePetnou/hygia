import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Patient } from '@hygia/types';

/** Champs modifiables d'un patient. */
export type PatientChanges = Partial<
  Pick<Patient, 'givenName' | 'familyName' | 'gender' | 'birthDate'>
>;

/** Corps de `PATCH /patients/:id`. */
export class UpdatePatientDto {
  @ApiPropertyOptional() givenName?: string;
  @ApiPropertyOptional() familyName?: string;
  @ApiPropertyOptional({ enum: ['female', 'male', 'other', 'unknown'] }) gender?: string;
  @ApiPropertyOptional({ example: '1955-03-12' }) birthDate?: string;
  @ApiPropertyOptional({ description: 'Motif de la modification (enregistré dans la version)' })
  motif?: string;
}

/** Corps de `POST /patients/:id/bris-de-glace`. */
export class BreakGlassDto {
  @ApiProperty({ description: "Motif de l'accès exceptionnel", example: 'urgence vitale' })
  motif!: string;
  @ApiPropertyOptional({ description: 'Précisions libres' }) precisions?: string;
}

const GENDERS = ['female', 'male', 'other', 'unknown'];

export function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException('Corps JSON attendu');
  }
  return body as Record<string, unknown>;
}

export function optionalText(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestException(`${key} doit être un texte non vide`);
  }
  return value;
}

/** Valide le corps d'un PATCH (champs inconnus ignorés, au moins un champ requis). */
export function parsePatientChanges(body: unknown): PatientChanges {
  const source = asObject(body);
  const changes: PatientChanges = {};
  const givenName = optionalText(source, 'givenName');
  const familyName = optionalText(source, 'familyName');
  const gender = optionalText(source, 'gender');
  const birthDate = optionalText(source, 'birthDate');
  if (givenName !== undefined) changes.givenName = givenName;
  if (familyName !== undefined) changes.familyName = familyName;
  if (gender !== undefined) {
    if (!GENDERS.includes(gender)) throw new BadRequestException('gender invalide');
    changes.gender = gender as Patient['gender'];
  }
  if (birthDate !== undefined) {
    if (Number.isNaN(Date.parse(birthDate))) throw new BadRequestException('birthDate invalide');
    changes.birthDate = birthDate;
  }
  if (Object.keys(changes).length === 0) throw new BadRequestException('Aucune modification');
  return changes;
}

/** Motif d'une modification ; `fallback` s'il est absent, 400 s'il est vide ou n'est pas un texte. */
export function parseReason(body: unknown, fallback?: string): string {
  const motif = optionalText(asObject(body), 'motif') ?? fallback;
  if (motif === undefined) throw new BadRequestException('motif obligatoire');
  return motif;
}

/** Valide le corps d'un bris de glace (motif obligatoire). */
export function parseBreakGlass(body: unknown): { motif: string; precisions: string } {
  const source = asObject(body);
  const motif = optionalText(source, 'motif');
  if (motif === undefined) throw new BadRequestException('motif obligatoire');
  const precisions = source['precisions'];
  if (precisions !== undefined && typeof precisions !== 'string') {
    throw new BadRequestException('precisions doit être un texte');
  }
  return { motif, precisions: precisions ?? '' };
}

/** Lit l'en-tête `If-Match` (`2`, `"2"` ou `W/"2"`) : 400 si absent ou invalide. */
export function parseIfMatch(header: string | undefined): number {
  if (header === undefined) {
    throw new BadRequestException('En-tête If-Match requis (version attendue)');
  }
  const version = Number(header.replace(/^W\//, '').replace(/"/g, '').trim());
  if (!Number.isInteger(version) || version < 1) {
    throw new BadRequestException('If-Match doit contenir un numéro de version entier');
  }
  return version;
}
