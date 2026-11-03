import { BadRequestException } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { SearchFilter } from '@hygia/fhir';
import { asObject } from '../patients/dto.js';

/** Corps de `POST /recherche`. */
export class SearchDto {
  @ApiPropertyOptional({
    description: 'Requête libre (français ou anglais), interprétée en filtres',
    example: 'patients diabétiques de plus de 60 ans vus depuis janvier avec une HbA1c > 8 %',
  })
  requete?: string;
  @ApiPropertyOptional({
    description:
      'Filtres structurés : s’ils sont fournis, la requête n’est pas réinterprétée (suppression d’une puce)',
    type: 'array',
    items: { type: 'object' },
  })
  filtres?: SearchFilter[];
  @ApiPropertyOptional({ description: 'Page (à partir de 1)', example: 1 }) page?: number;
  @ApiPropertyOptional({ description: 'Résultats par page (1 à 100)', example: 10 }) taille?: number;
}

/** Demande de recherche validée. */
export interface SearchRequest {
  query: string;
  filters?: SearchFilter[];
  page: number;
  size: number;
}

const KINDS = ['diagnosis', 'age', 'lastVisit', 'lab', 'gender', 'text'];
const DEFAULT_SIZE = 10;
const MAX_SIZE = 100;

function positiveInteger(value: unknown, fallback: number, max: number, name: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) {
    throw new BadRequestException(`${name} doit être un entier entre 1 et ${max}`);
  }
  return value;
}

/** Valide le corps de `POST /recherche`. */
export function parseSearch(body: unknown): SearchRequest {
  const source = asObject(body);
  const query = source['requete'];
  if (query !== undefined && typeof query !== 'string') {
    throw new BadRequestException('requete doit être un texte');
  }
  const raw = source['filtres'];
  let filters: SearchFilter[] | undefined;
  if (raw !== undefined) {
    if (!Array.isArray(raw) || raw.some((f) => typeof f !== 'object' || f === null || !KINDS.includes((f as { kind?: string }).kind ?? ''))) {
      throw new BadRequestException('filtres invalides');
    }
    filters = raw as SearchFilter[];
  }
  if (query === undefined && filters === undefined) {
    throw new BadRequestException('requete ou filtres obligatoire');
  }
  return {
    query: query ?? '',
    ...(filters ? { filters } : {}),
    page: positiveInteger(source['page'], 1, Number.MAX_SAFE_INTEGER, 'page'),
    size: positiveInteger(source['taille'], DEFAULT_SIZE, MAX_SIZE, 'taille'),
  };
}
