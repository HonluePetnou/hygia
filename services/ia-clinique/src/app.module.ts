import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { remoteVerifier } from '@hygia/auth';
import { AuditLog, InMemoryAuditStore } from '@hygia/audit';
import { demoDataset } from '@hygia/fhir';
import { createObservability } from '@hygia/observability';
import { AccessPolicy } from './access/access-policy.js';
import { CLINICAL_DIRECTORY, DemoClinicalDirectory } from './access/clinical-directory.js';
import { JwtAuthGuard, TOKEN_VERIFIER } from './auth/jwt-auth.guard.js';
import { CONSENT_GATE, HttpConsentGate } from './consent/consent-gate.js';
import { loadEnv } from './config/env.js';
import { CopiloteController } from './copilote/copilote.controller.js';
import { AUDIT_LOG, CopiloteService } from './copilote/copilote.service.js';
import { WORD_DELAY_MS } from './copilote/sse.js';
import { buildDemoCorpus } from './corpus/demo-corpus.js';
import { InMemoryPassageIndex } from './index/in-memory-passage-index.js';
import { PASSAGE_INDEX } from './index/passage-index.js';
import { CLINICAL_LANGUAGE_MODEL } from './model/clinical-language-model.js';
import { MockClinicalLanguageModel } from './model/mock-clinical-language-model.js';
import { DOSSIER_WRITER, HttpDossierWriter } from './scribe/dossier-writer.js';
import { MockTranscriber } from './scribe/mock-transcriber.js';
import { ScribeController } from './scribe/scribe.controller.js';
import { ScribeService } from './scribe/scribe.service.js';
import { InMemoryScribeSessionStore, SCRIBE_SESSION_STORE } from './scribe/scribe-session.js';
import { TRANSCRIBER } from './scribe/transcriber.js';
import { ResumeController } from './resume/resume.controller.js';
import { ResumeService } from './resume/resume.service.js';

/** Module racine : index, annuaire, audit et modèle en mémoire (Bedrock / pgvector ensuite). */
@Module({
  controllers: [CopiloteController, ResumeController, ScribeController],
  providers: [
    CopiloteService,
    ResumeService,
    ScribeService,
    { provide: TRANSCRIBER, useFactory: () => new MockTranscriber() },
    { provide: SCRIBE_SESSION_STORE, useFactory: () => new InMemoryScribeSessionStore() },
    { provide: DOSSIER_WRITER, useFactory: () => new HttpDossierWriter(loadEnv().dossiersUrl) },
    AccessPolicy,
    JwtAuthGuard,
    { provide: TOKEN_VERIFIER, useFactory: () => remoteVerifier(loadEnv().jwksUrl) },
    {
      provide: CONSENT_GATE,
      useFactory: () => new HttpConsentGate(loadEnv().dossiersUrl, loadEnv().internalKey),
    },
    { provide: WORD_DELAY_MS, useValue: 25 },
    { provide: CLINICAL_LANGUAGE_MODEL, useFactory: () => new MockClinicalLanguageModel() },
    { provide: PASSAGE_INDEX, useFactory: () => new InMemoryPassageIndex(buildDemoCorpus()) },
    { provide: CLINICAL_DIRECTORY, useFactory: () => new DemoClinicalDirectory(demoDataset) },
    { provide: AUDIT_LOG, useFactory: () => new AuditLog(new InMemoryAuditStore()) },
  ],
})
export class AppModule implements NestModule {
  /** `/health`, `/metrics` et journal `x-correlation-id`. */
  configure(consumer: MiddlewareConsumer): void {
    const quiet = process.env['NODE_ENV'] === 'test';
    const { middleware } = createObservability({
      service: 'ia-clinique',
      ...(quiet ? { log: () => undefined } : {}),
    });
    consumer.apply(middleware).forRoutes('*path');
  }
}
