import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { DocumentReference } from '@hygia/types';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { parseIfMatch } from '../patients/dto.js';
import type { ResourceVersion } from '../versions/resource-version.js';
import { VersionsService } from '../versions/versions.service.js';
import { UpdateDocumentDto, parseDocumentChanges } from './dto.js';
import { DocumentsService } from './documents.service.js';

/** API REST des documents et de leur historique de versions (RF5). */
@ApiTags('documents')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Jeton absent, invalide ou expiré' })
@ApiResponse({ status: 403, description: 'Accès refusé (rôle ou équipe de soins)' })
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly versions: VersionsService,
  ) {}

  @Patch(':id')
  @ApiOperation({ summary: 'Modifie un document : crée une nouvelle version immuable' })
  @ApiHeader({ name: 'If-Match', description: 'Version courante du document', required: true })
  @ApiResponse({ status: 409, description: 'Version périmée' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: UpdateDocumentDto,
  ): Promise<DocumentReference> {
    const { changes, reason } = parseDocumentChanges(body);
    return this.documents.update(user, id, changes, parseIfMatch(ifMatch), reason);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Historique des versions d’un document, de la plus ancienne à la plus récente' })
  list(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ResourceVersion[]> {
    return this.versions.forDocument(user, id);
  }

  @Get(':id/versions/:n')
  @ApiOperation({ summary: 'Une version précise d’un document (lecture auditée)' })
  @ApiResponse({ status: 404, description: 'Document ou version introuvable' })
  one(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('n') n: string,
  ): Promise<ResourceVersion> {
    const number = Number(n);
    if (!Number.isInteger(number) || number < 1) {
      throw new BadRequestException('Le numéro de version doit être un entier positif');
    }
    return this.versions.documentVersion(user, id, number);
  }
}
