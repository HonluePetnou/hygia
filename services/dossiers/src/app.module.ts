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
import { AUDIT_LOG, PatientsService } from './patients/patients.service.js';

/** Module racine : dépôt et audit en mémoire (remplaçables par Prisma / DynamoDB). */
@Module({
  controllers: [PatientsController],
  providers: [
    PatientsService,
    AccessPolicy,
    JwtAuthGuard,
    { provide: TOKEN_VERIFIER, useFactory: () => remoteVerifier(loadEnv().jwksUrl) },
    { provide: CLOCK, useClass: SystemClock },
    { provide: PATIENT_REPOSITORY, useFactory: () => new InMemoryPatientRepository(demoDataset) },
    { provide: AUDIT_LOG, useFactory: () => new AuditLog(new InMemoryAuditStore()) },
  ],
})
export class AppModule {}
