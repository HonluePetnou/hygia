import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { AuditLog, InMemoryAuditStore } from '@hygia/audit';
import { remoteVerifier } from '@hygia/auth';
import { createObservability } from '@hygia/observability';
import { JwtAuthGuard, TOKEN_VERIFIER } from './auth/jwt-auth.guard.js';
import { loadEnv } from './config/env.js';
import { ConflictService, CLOCK } from './sync/conflict.service.js';
import { SyncController } from './sync/sync.controller.js';
import { AUDIT_LOG, SyncService } from './sync/sync.service.js';
import { SYNC_STORE, SyncStore } from './sync/sync-store.js';

/** Module racine : magasin et audit en mémoire (remplaçables par PostgreSQL). */
@Module({
  controllers: [SyncController],
  providers: [
    JwtAuthGuard,
    SyncService,
    ConflictService,
    { provide: SYNC_STORE, useFactory: () => new SyncStore() },
    { provide: AUDIT_LOG, useFactory: () => new AuditLog(new InMemoryAuditStore()) },
    { provide: CLOCK, useValue: () => new Date() },
    { provide: TOKEN_VERIFIER, useFactory: () => remoteVerifier(loadEnv().jwksUrl) },
  ],
})
export class AppModule implements NestModule {
  /** `/health`, `/metrics` et journal `x-correlation-id`. */
  configure(consumer: MiddlewareConsumer): void {
    const quiet = process.env['NODE_ENV'] === 'test';
    const { middleware } = createObservability({
      service: 'synchronisation',
      ...(quiet ? { log: () => undefined } : {}),
    });
    consumer.apply(middleware).forRoutes('*path');
  }
}
