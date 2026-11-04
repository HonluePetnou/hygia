import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { createObservability } from '@hygia/observability';
import { remoteVerifier } from '@hygia/auth';
import { AuditLog, InMemoryAuditStore } from '@hygia/audit';
import { RuleBasedQueryInterpreter, demoDataset } from '@hygia/fhir';
import { AccessPolicy } from './access/access-policy.js';
import { InMemoryAlertEventPublisher, ALERT_EVENTS } from './alertes/alert-events.js';
import { ALERT_REPOSITORY, InMemoryAlertRepository } from './alertes/alert-repository.js';
import { AlertesController } from './alertes/alertes.controller.js';
import { AlertesService } from './alertes/alertes.service.js';
import { demoAlerts } from './alertes/demo-alerts.js';
import { CLOCK, SystemClock, type Clock } from './access/clock.js';
import { JwtAuthGuard, TOKEN_VERIFIER } from './auth/jwt-auth.guard.js';
import { loadEnv, type Env } from './config/env.js';
import { ENV } from './config/env-token.js';
import { ForwardingAuditStore } from './audit/forwarding-audit-store.js';
import { ConsentsController, InternalConsentsController } from './consents/consents.controller.js';
import { CONSENT_REPOSITORY, InMemoryConsentRepository } from './consents/consent-repository.js';
import { ConsentsService } from './consents/consents.service.js';
import { InMemoryPatientRepository } from './patients/in-memory-patient-repository.js';
import { PATIENT_REPOSITORY } from './patients/patient-repository.js';
import { PatientsController } from './patients/patients.controller.js';
import { AUDIT_LOG } from './patients/audit-token.js';
import { PatientsService } from './patients/patients.service.js';
import { ConsultationsController } from './consultations/consultations.controller.js';
import { ConsultationsService } from './consultations/consultations.service.js';
import { DocumentsController } from './documents/documents.controller.js';
import { DocumentsService } from './documents/documents.service.js';
import { DoublonsController } from './doublons/doublons.controller.js';
import { DUPLICATE_THRESHOLD, DuplicatesService } from './doublons/duplicates.service.js';
import { MergeService } from './doublons/merge.service.js';
import { ExportsController } from './exports/exports.controller.js';
import { ExportsService } from './exports/exports.service.js';
import { EPIDEMIOLOGY_SOURCE, HttpEpidemiologySource } from './exports/epidemiology-source.js';
import { RechercheController } from './recherche/recherche.controller.js';
import { QUERY_INTERPRETER, SearchService } from './recherche/search.service.js';
import { DOCUMENT_STORE } from './versions/document-store.js';
import { InMemoryDocumentStore } from './versions/in-memory-document-store.js';
import { S3ClientOperations } from './versions/s3-client-operations.js';
import { S3DocumentStore } from './versions/s3-document-store.js';
import { VersionsController } from './versions/versions.controller.js';
import { VersionsService } from './versions/versions.service.js';
import { SyntheseController } from './synthese/synthese.controller.js';
import { TableauDeBordController } from './tableau-de-bord/tableau-de-bord.controller.js';

/** Module racine : dépôt et audit en mémoire (remplaçables par Prisma / DynamoDB). */
@Module({
  controllers: [
    PatientsController,
    VersionsController,
    DocumentsController,
    DoublonsController,
    RechercheController,
    AlertesController,
    ExportsController,
    ConsentsController,
    InternalConsentsController,
    ConsultationsController,
    SyntheseController,
    TableauDeBordController,
  ],
  providers: [
    ConsultationsService,
    ConsentsService,
    { provide: CONSENT_REPOSITORY, useFactory: () => new InMemoryConsentRepository() },
    { provide: ENV, useFactory: () => loadEnv() },
    ExportsService,
    {
      provide: EPIDEMIOLOGY_SOURCE,
      useFactory: () => new HttpEpidemiologySource(loadEnv().agentsUrl),
    },
    AlertesService,
    { provide: ALERT_REPOSITORY, useFactory: () => new InMemoryAlertRepository(demoAlerts()) },
    { provide: ALERT_EVENTS, useFactory: () => new InMemoryAlertEventPublisher() },
    PatientsService,
    DocumentsService,
    DuplicatesService,
    SearchService,
    {
      provide: QUERY_INTERPRETER,
      useFactory: (clock: Clock) =>
        new RuleBasedQueryInterpreter(() => clock.now().toISOString().slice(0, 10)),
      inject: [CLOCK],
    },
    MergeService,
    { provide: DUPLICATE_THRESHOLD, useFactory: () => loadEnv().duplicateThreshold },
    VersionsService,
    {
      provide: DOCUMENT_STORE,
      // DOSSIERS_S3_BUCKET : versions immuables sur S3 versionné (LocalStack ou AWS).
      useFactory: (env: Env) =>
        env.documentsS3
          ? new S3DocumentStore(new S3ClientOperations(env.documentsS3))
          : new InMemoryDocumentStore(),
      inject: [ENV],
    },
    AccessPolicy,
    JwtAuthGuard,
    { provide: TOKEN_VERIFIER, useFactory: () => remoteVerifier(loadEnv().jwksUrl) },
    { provide: CLOCK, useClass: SystemClock },
    { provide: PATIENT_REPOSITORY, useFactory: () => new InMemoryPatientRepository(demoDataset) },
    {
      provide: AUDIT_LOG,
      useFactory: (env: Env) => {
        if (env.audit === undefined) return new AuditLog(new InMemoryAuditStore());
        // Noms des acteurs connus de Dossiers (praticiens, patients) pour le journal du service Audit.
        const names = new Map<string, string>([
          ...demoDataset.practitioners.map((p): [string, string] => [p.id, p.name]),
          ...demoDataset.patients.map((p): [string, string] => [
            p.id,
            `${p.givenName} ${p.familyName}`,
          ]),
        ]);
        return new AuditLog(
          new ForwardingAuditStore({ ...env.audit, resolveActor: (id) => names.get(id) }),
        );
      },
      inject: [ENV],
    },
  ],
})
export class AppModule implements NestModule {
  /** `/health`, `/metrics` et journal `x-correlation-id`. */
  configure(consumer: MiddlewareConsumer): void {
    const quiet = process.env['NODE_ENV'] === 'test';
    const { middleware } = createObservability({
      service: 'dossiers',
      ...(quiet ? { log: () => undefined } : {}),
    });
    consumer.apply(middleware).forRoutes('*path');
  }
}
