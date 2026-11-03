import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { asObject, optionalText } from '../patients/dto.js';
import type { MergeableFields } from '../patients/patient-repository.js';

/** Côté d'où provient la valeur conservée : `a` = dossier conservé, `b` = dossier fusionné. */
export type Side = 'a' | 'b';

/** Champs de la fiche dont la fusion laisse choisir la valeur. */
export const MERGE_FIELDS = ['givenName', 'familyName', 'gender', 'birthDate', 'phone'] as const;

/** Corps de `POST /patients/:a/fusion/:b`. */
export class MergeDto {
  @ApiProperty({ description: 'Motif de la fusion', example: 'même patiente, saisie en double' })
  motif!: string;
  @ApiPropertyOptional({
    description: 'Pour chaque champ (givenName, familyName, gender, birthDate, phone) : « a » (défaut) ou « b »',
    example: { familyName: 'b' },
  })
  choix?: Partial<Record<(typeof MERGE_FIELDS)[number], Side>>;
  @ApiPropertyOptional({
    description: 'Versions attendues des deux fiches (contrôle optimiste)',
    example: { a: 1, b: 1 },
  })
  versions?: { a: number; b: number };
}

/** Demande de fusion validée. */
export interface MergeRequest {
  reason: string;
  choices: Record<(typeof MERGE_FIELDS)[number], Side>;
  versions?: { a: number; b: number };
}

/** Valide le corps d'une fusion (motif obligatoire, choix « a » par défaut). */
export function parseMerge(body: unknown): MergeRequest {
  const source = asObject(body);
  const reason = optionalText(source, 'motif');
  if (reason === undefined) throw new BadRequestException('motif obligatoire');
  const rawChoices = source['choix'] === undefined ? {} : asObject(source['choix']);
  const choices = { givenName: 'a', familyName: 'a', gender: 'a', birthDate: 'a', phone: 'a' } as MergeRequest['choices'];
  for (const [field, side] of Object.entries(rawChoices)) {
    if (!(MERGE_FIELDS as readonly string[]).includes(field) || (side !== 'a' && side !== 'b')) {
      throw new BadRequestException(`choix invalide pour ${field} (champ connu et « a » ou « b » attendus)`);
    }
    choices[field as keyof typeof choices] = side;
  }
  const request: MergeRequest = { reason, choices };
  if (source['versions'] !== undefined) {
    const { a, b } = asObject(source['versions']);
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      throw new BadRequestException('versions : entiers « a » et « b » attendus');
    }
    request.versions = { a: a as number, b: b as number };
  }
  return request;
}

/** Champs de la fiche résultante d'après les choix. */
export function chosenFields(
  kept: MergeableFields,
  merged: MergeableFields,
  choices: MergeRequest['choices'],
): MergeableFields {
  const pick = <K extends keyof MergeableFields>(field: K): MergeableFields[K] =>
    choices[field] === 'b' ? merged[field] : kept[field];
  const fields: MergeableFields = {
    givenName: pick('givenName'),
    familyName: pick('familyName'),
    gender: pick('gender'),
    birthDate: pick('birthDate'),
  };
  const phone = pick('phone');
  if (phone !== undefined) fields.phone = phone;
  return fields;
}
