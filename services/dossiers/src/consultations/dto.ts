import { BadRequestException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import type { Coding } from '@hygia/types';
import { asObject } from '../patients/dto.js';
import type { ConsultationInput } from './consultation.js';

const MAX_ITEMS = 50;

/** Corps de `POST /patients/:id/consultations` (brouillon du scribe validé par le médecin). */
export class ConsultationDto {
  @ApiProperty({ description: 'Mesures : { code: {system, code, display}, value, unit }[]' })
  observations!: unknown[];
  @ApiProperty({ description: 'Diagnostics CIM-10 : { system, code, display }[]' })
  conditions!: unknown[];
  @ApiProperty({
    description:
      'Prescriptions : { medication: {system, code, display}, doseValue, doseUnit, timesPerDay }[]',
  })
  prescriptions!: unknown[];
}

function list(source: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = source[key] ?? [];
  if (!Array.isArray(value) || value.length > MAX_ITEMS) {
    throw new BadRequestException(`${key} doit être une liste de ${MAX_ITEMS} éléments au plus`);
  }
  return value.map((item) => asObject(item));
}

function text(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestException(`${key} doit être un texte non vide`);
  }
  return value;
}

function num(source: Record<string, unknown>, key: string, positive = false): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || (positive && value <= 0)) {
    throw new BadRequestException(
      `${key} doit être un nombre${positive ? ' strictement positif' : ''}`,
    );
  }
  return value;
}

function coding(raw: unknown): Coding {
  const source = asObject(raw);
  return {
    system: text(source, 'system'),
    code: text(source, 'code'),
    display: text(source, 'display'),
  };
}

/** Valide le corps ; au moins un élément clinique est exigé. */
export function parseConsultation(body: unknown): ConsultationInput {
  const source = asObject(body);
  const input: ConsultationInput = {
    observations: list(source, 'observations').map((o) => ({
      code: coding(o['code']),
      value: num(o, 'value'),
      unit: text(o, 'unit'),
    })),
    conditions: list(source, 'conditions').map(coding),
    prescriptions: list(source, 'prescriptions').map((p) => ({
      medication: coding(p['medication']),
      doseValue: num(p, 'doseValue', true),
      doseUnit: text(p, 'doseUnit'),
      timesPerDay: num(p, 'timesPerDay', true),
    })),
  };
  if (input.observations.length + input.conditions.length + input.prescriptions.length === 0) {
    throw new BadRequestException('La consultation ne contient aucun élément clinique');
  }
  return input;
}
