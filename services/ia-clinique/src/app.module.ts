import { Module } from '@nestjs/common';
import { AuditLog, InMemoryAuditStore } from '@hygia/audit';
import { demoDataset } from '@hygia/fhir';
import { AccessPolicy } from './access/access-policy.js';
import { CLINICAL_DIRECTORY, DemoClinicalDirectory } from './access/clinical-directory.js';
import { HeaderAuthGuard } from './auth/header-auth.guard.js';
import { CopiloteController } from './copilote/copilote.controller.js';
import { AUDIT_LOG, CopiloteService } from './copilote/copilote.service.js';
import { WORD_DELAY_MS } from './copilote/sse.js';
import { buildDemoCorpus } from './corpus/demo-corpus.js';
import { InMemoryPassageIndex } from './index/in-memory-passage-index.js';
import { PASSAGE_INDEX } from './index/passage-index.js';
import { CLINICAL_LANGUAGE_MODEL } from './model/clinical-language-model.js';
import { MockClinicalLanguageModel } from './model/mock-clinical-language-model.js';
import { ResumeController } from './resume/resume.controller.js';
import { ResumeService } from './resume/resume.service.js';

/** Module racine : index, annuaire, audit et modèle en mémoire (Bedrock / pgvector ensuite). */
@Module({
  controllers: [CopiloteController, ResumeController],
  providers: [
    CopiloteService,
    ResumeService,
    AccessPolicy,
    HeaderAuthGuard,
    { provide: WORD_DELAY_MS, useValue: 25 },
    { provide: CLINICAL_LANGUAGE_MODEL, useFactory: () => new MockClinicalLanguageModel() },
    { provide: PASSAGE_INDEX, useFactory: () => new InMemoryPassageIndex(buildDemoCorpus()) },
    { provide: CLINICAL_DIRECTORY, useFactory: () => new DemoClinicalDirectory(demoDataset) },
    { provide: AUDIT_LOG, useFactory: () => new AuditLog(new InMemoryAuditStore()) },
  ],
})
export class AppModule {}
