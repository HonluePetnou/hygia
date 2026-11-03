import { Module } from '@nestjs/common';
import { remoteVerifier } from '@hygia/auth';
import { AuditLog, InMemoryAuditStore } from '@hygia/audit';
import { demoDataset } from '@hygia/fhir';
import { AccessPolicy } from './access/access-policy.js';
import { CLOCK, SystemClock } from './access/clock.js';
import { JwtAuthGuard, TOKEN_VERIFIER } from './auth/jwt-auth.guard.js';
import { loadEnv } from './config/env.js';
import { InMemoryPatientRepository } from './patients/in-memory-patient-repository.js';
import { PATIENT_REPOSITORY } from './patients/patient-repository.js';
import { PatientsController } from './patients/patients.controller.js';
import { AUDIT_LOG } from './patients/audit-token.js';
import { PatientsService } from './patients/patients.service.js';
import { DocumentsController } from './documents/documents.controller.js';
import { DocumentsService } from './documents/documents.service.js';
import { DoublonsController } from './doublons/doublons.controller.js';
import { DUPLICATE_THRESHOLD, DuplicatesService } from './doublons/duplicates.service.js';
import { MergeService } from './doublons/merge.service.js';
import { DOCUMENT_STORE } from './versions/document-store.js';
import { InMemoryDocumentStore } from './versions/in-memory-document-store.js';
import { VersionsController } from './versions/versions.controller.js';
import { VersionsService } from './versions/versions.service.js';

/** Module racine : dépôt et audit en mémoire (remplaçables par Prisma / DynamoDB). */
@Module({
  controllers: [PatientsController, VersionsController, DocumentsController, DoublonsController],
  providers: [
    PatientsService,
    DocumentsService,
    DuplicatesService,
    MergeService,
    { provide: DUPLICATE_THRESHOLD, useFactory: () => loadEnv().duplicateThreshold },
    VersionsService,
    { provide: DOCUMENT_STORE, useFactory: () => new InMemoryDocumentStore() },
    AccessPolicy,
    JwtAuthGuard,
    { provide: TOKEN_VERIFIER, useFactory: () => remoteVerifier(loadEnv().jwksUrl) },
    { provide: CLOCK, useClass: SystemClock },
    { provide: PATIENT_REPOSITORY, useFactory: () => new InMemoryPatientRepository(demoDataset) },
    { provide: AUDIT_LOG, useFactory: () => new AuditLog(new InMemoryAuditStore()) },
  ],
})
export class AppModule {}
