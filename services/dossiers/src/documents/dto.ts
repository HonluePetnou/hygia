import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { asObject, optionalText, parseReason } from '../patients/dto.js';
import type { ProcessingStatus } from '@hygia/types';
import type { DocumentChanges } from '../patients/patient-repository.js';

/** Corps de `PATCH /documents/:id`. */
export class UpdateDocumentDto {
  @ApiPropertyOptional() title?: string;
  @ApiPropertyOptional() documentType?: string;
  @ApiPropertyOptional({ enum: ['fr', 'en'] }) language?: string;
  @ApiPropertyOptional({ enum: ['received', 'processing', 'processed', 'failed'] })
  processingStatus?: string;
  @ApiProperty({ description: 'Motif de la modification (enregistré dans la version)' })
  motif!: string;
}

const LANGUAGES = ['fr', 'en'];
const STATUSES = ['received', 'processing', 'processed', 'failed'];

/** Valide le corps d'un PATCH de document : au moins un champ et un motif. */
export function parseDocumentChanges(body: unknown): { changes: DocumentChanges; reason: string } {
  const source = asObject(body);
  const changes: DocumentChanges = {};
  const title = optionalText(source, 'title');
  const documentType = optionalText(source, 'documentType');
  const language = optionalText(source, 'language');
  const status = optionalText(source, 'processingStatus');
  if (title !== undefined) changes.title = title;
  if (documentType !== undefined) changes.documentType = documentType;
  if (language !== undefined) {
    if (!LANGUAGES.includes(language)) throw new BadRequestException('language invalide');
    changes.language = language as 'fr' | 'en';
  }
  if (status !== undefined) {
    if (!STATUSES.includes(status)) throw new BadRequestException('processingStatus invalide');
    changes.processingStatus = status as ProcessingStatus;
  }
  if (Object.keys(changes).length === 0) throw new BadRequestException('Aucune modification');
  return { changes, reason: parseReason(body) };
}
