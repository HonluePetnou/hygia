import { Body, Controller, HttpCode, Param, Post, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  DossierExportDto,
  ReportExportDto,
  SearchExportDto,
  parseDossierExport,
  parseReportExport,
  parseSearchExport,
} from './dto.js';
import { ExportsService, type ExportedFile } from './exports.service.js';

function send(response: Response, type: string, file: ExportedFile<Buffer | string>): StreamableFile {
  response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  response.setHeader('Cache-Control', 'no-store');
  return new StreamableFile(Buffer.from(file.content), { type });
}

/** Exports PDF et CSV (RF17) ; chaque export est audité (`export`). */
@ApiTags('exports')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Jeton absent, invalide ou expiré' })
@ApiResponse({ status: 403, description: 'Export refusé (rôle ou équipe de soins)' })
@UseGuards(JwtAuthGuard)
@Controller()
export class ExportsController {
  constructor(private readonly service: ExportsService) {}

  @Post('patients/:id/export.pdf')
  @HttpCode(200)
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'PDF du dossier (identité, allergies, traitements, chronologie, résumé validé)' })
  dossier(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: DossierExportDto,
    @Res({ passthrough: true }) response: Response,
  ): StreamableFile {
    const request = parseDossierExport(body);
    return send(response, 'application/pdf', this.service.dossierPdf(user, id, request.language, request.summary));
  }

  @Post('recherche/export.csv')
  @HttpCode(200)
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'CSV des patients correspondant à une recherche (dossiers de votre équipe uniquement)' })
  searchCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SearchExportDto,
    @Res({ passthrough: true }) response: Response,
  ): StreamableFile {
    const { search, language } = parseSearchExport(body);
    return send(response, 'text/csv; charset=utf-8', this.service.searchCsv(user, search, language));
  }

  @Post('analytique/rapport.pdf')
  @HttpCode(200)
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Rapport épidémiologique en PDF (rôle analyste, données pseudonymisées)' })
  async report(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReportExportDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { language, pathology } = parseReportExport(body);
    return send(response, 'application/pdf', await this.service.epidemiologyPdf(user, language, pathology));
  }
}
