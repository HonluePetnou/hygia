import { BadRequestException } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { Language } from '@hygia/types';
import { asObject } from '../patients/dto.js';
import { parseSearch, SearchDto, type SearchRequest } from '../recherche/dto.js';

const MAX_SUMMARY_LINES = 50;
const MAX_LINE_LENGTH = 500;

/** Corps de `POST /patients/:id/export.pdf`. */
export class DossierExportDto {
  @ApiPropertyOptional({ enum: ['fr', 'en'], description: 'Langue du document (défaut : fr)' }) langue?: Language;
  @ApiPropertyOptional({
    type: [String],
    description: 'Lignes du résumé IA validé par le soignant ; omis si le résumé n’a pas été validé',
  })
  resume?: string[];
}

/** Corps de `POST /recherche/export.csv` : une recherche et la langue des en-têtes. */
export class SearchExportDto extends SearchDto {
  @ApiPropertyOptional({ enum: ['fr', 'en'], description: 'Langue des en-têtes (défaut : fr)' }) langue?: Language;
}

/** Corps de `POST /analytique/rapport.pdf`. */
export class ReportExportDto {
  @ApiPropertyOptional({ enum: ['fr', 'en'], description: 'Langue du rapport (défaut : fr)' }) langue?: Language;
  @ApiPropertyOptional({ description: 'Pathologie à isoler (toutes par défaut)', example: 'choléra' }) pathologie?: string;
}

/** Langue demandée, français par défaut. */
export function parseLanguage(value: unknown): Language {
  if (value === undefined) return 'fr';
  if (value === 'fr' || value === 'en') return value;
  throw new BadRequestException('langue doit valoir fr ou en');
}

/** Export de dossier validé. */
export interface DossierExportRequest {
  language: Language;
  summary: string[] | undefined;
}

/** Valide le corps de l'export PDF d'un dossier. */
export function parseDossierExport(body: unknown): DossierExportRequest {
  const source = asObject(body ?? {});
  const raw = source['resume'];
  let summary: string[] | undefined;
  if (raw !== undefined) {
    const valid =
      Array.isArray(raw) &&
      raw.length <= MAX_SUMMARY_LINES &&
      raw.every((line) => typeof line === 'string' && line.length <= MAX_LINE_LENGTH);
    if (!valid) throw new BadRequestException('resume doit être une liste de textes courts');
    summary = raw as string[];
  }
  return { language: parseLanguage(source['langue']), summary };
}

/** Export CSV validé : la recherche à rejouer et la langue des en-têtes. */
export function parseSearchExport(body: unknown): { search: SearchRequest; language: Language } {
  const source = asObject(body);
  return { search: parseSearch(body), language: parseLanguage(source['langue']) };
}

/** Export du rapport validé. */
export function parseReportExport(body: unknown): { language: Language; pathology: string | undefined } {
  const source = asObject(body ?? {});
  const pathology = source['pathologie'];
  if (pathology !== undefined && (typeof pathology !== 'string' || pathology.length === 0 || pathology.length > 64)) {
    throw new BadRequestException('pathologie invalide');
  }
  return { language: parseLanguage(source['langue']), pathology };
}
