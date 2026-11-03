import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Language } from '@hygia/types';
import { CONSENT_PURPOSES, type ConsentPurpose } from './consent.js';

/** Corps de `PUT /patients/:id/consents/:purpose`. */
export class UpdateConsentDto {
  @ApiProperty({ description: 'true : accorder ; false : révoquer' })
  granted!: boolean;

  @ApiPropertyOptional({ description: 'Version lue ; refus (409) si elle a changé' })
  version?: number;
}

/** Corps de `PUT /patients/:id/language`. */
export class LanguageDto {
  @ApiProperty({ enum: ['fr', 'en'] })
  language!: Language;
}

/** Valide la finalité d'une URL. */
export function parsePurpose(value: string): ConsentPurpose {
  if (!(CONSENT_PURPOSES as readonly string[]).includes(value)) {
    throw new BadRequestException(`Finalité inconnue (${CONSENT_PURPOSES.join(', ')})`);
  }
  return value as ConsentPurpose;
}

/** Valide le corps d'une mise à jour de consentement. */
export function parseUpdate(body: UpdateConsentDto | undefined): {
  granted: boolean;
  version: number | undefined;
} {
  if (typeof body?.granted !== 'boolean') throw new BadRequestException('granted (booléen) requis');
  if (body.version !== undefined && !Number.isInteger(body.version)) {
    throw new BadRequestException('version doit être un entier');
  }
  return { granted: body.granted, version: body.version };
}

/** Valide la langue. */
export function parseLanguage(body: LanguageDto | undefined): Language {
  if (body?.language !== 'fr' && body?.language !== 'en')
    throw new BadRequestException('language : fr ou en');
  return body.language;
}
