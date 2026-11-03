import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Corps de `POST /auth/login`. */
export class LoginDto {
  @ApiProperty({ example: 'aicha.nana@hd-bonassama.cm' }) email!: string;
  @ApiProperty({ example: 'Hygia-demo-2026' }) password!: string;
}

/** Corps de `POST /auth/mfa/enroll`. */
export class EnrollDto {
  @ApiProperty() challengeId!: string;
}

/** Corps de `POST /auth/mfa/verify` : un code TOTP ou un code de secours. */
export class VerifyDto {
  @ApiProperty() challengeId!: string;
  @ApiPropertyOptional({ description: 'Code TOTP à 6 chiffres' }) code?: string;
  @ApiPropertyOptional({ description: 'Code de secours (usage unique)' }) backupCode?: string;
}

/** Corps de `POST /bris-de-glace`. */
export class BreakGlassDto {
  @ApiProperty() patientId!: string;
  @ApiProperty({ example: 'urgence vitale' }) motif!: string;
  @ApiPropertyOptional() precisions?: string;
}

/** Lit un objet JSON ; 400 sinon. */
export function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException('Corps JSON attendu');
  }
  return body as Record<string, unknown>;
}

/** Texte obligatoire non vide ; 400 sinon. */
export function requiredText(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestException(`${key} requis`);
  }
  return value;
}

/** Texte facultatif ; 400 s'il est présent mais invalide. */
export function optionalText(source: Record<string, unknown>, key: string): string | undefined {
  if (source[key] === undefined) return undefined;
  return requiredText(source, key);
}
