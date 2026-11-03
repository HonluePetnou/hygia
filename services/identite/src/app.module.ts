import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { createObservability } from '@hygia/observability';
import { TokenIssuer, localVerifier } from '@hygia/auth';
import { AuditLog, InMemoryAuditStore } from '@hygia/audit';
import { AccountAdminService } from './admin/account-admin.service.js';
import { AdminAudit, AUDIT_LOG } from './admin/admin-audit.js';
import { AccountsController } from './admin/accounts.controller.js';
import { AdminGuard } from './admin/admin.guard.js';
import { TeamsController } from './admin/teams.controller.js';
import { ACCOUNT_REPOSITORY, InMemoryAccountRepository } from './accounts/account-repository.js';
import { buildDemoAccounts } from './accounts/demo-accounts.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { ChallengeStore } from './auth/challenge-store.js';
import { JWT_ENV } from './auth/env-token.js';
import { JwksController } from './auth/jwks.controller.js';
import { JwtAuthGuard, TOKEN_VERIFIER } from './auth/jwt-auth.guard.js';
import { SessionTokens, TOKEN_ISSUER } from './auth/session-tokens.js';
import { loadEnv, type Env } from './config/env.js';
import { EmergencyController } from './emergency/emergency.controller.js';
import { EmergencyService } from './emergency/emergency.service.js';
import { EVENT_BUS, InMemoryEventBus } from './events/event-bus.js';
import { BcryptPasswordHasher, PASSWORD_HASHER, type PasswordHasher } from './security/password-hasher.js';
import { TotpService } from './security/totp.service.js';
import { InMemoryTeamRepository, TEAM_REPOSITORY, demoTeams } from './teams/team-repository.js';
import { CLOCK, SystemClock, type Clock } from './time/clock.js';

/** Module racine : dépôts, bus et clés en mémoire (remplaçables par Cognito / PostgreSQL / SNS). */
@Module({
  controllers: [AuthController, EmergencyController, AccountsController, TeamsController, JwksController],
  providers: [
    AuthService,
    ChallengeStore,
    SessionTokens,
    EmergencyService,
    TotpService,
    JwtAuthGuard,
    AdminGuard,
    AdminAudit,
    AccountAdminService,
    { provide: AUDIT_LOG, useFactory: () => new AuditLog(new InMemoryAuditStore()) },
    { provide: JWT_ENV, useFactory: (): Env => loadEnv() },
    { provide: CLOCK, useClass: SystemClock },
    { provide: EVENT_BUS, useClass: InMemoryEventBus },
    { provide: TEAM_REPOSITORY, useFactory: () => new InMemoryTeamRepository(demoTeams()) },
    {
      provide: PASSWORD_HASHER,
      useFactory: (env: Env) => new BcryptPasswordHasher(env.bcryptCost),
      inject: [JWT_ENV],
    },
    {
      provide: ACCOUNT_REPOSITORY,
      useFactory: async (hasher: PasswordHasher) => new InMemoryAccountRepository(await buildDemoAccounts(hasher)),
      inject: [PASSWORD_HASHER],
    },
    {
      provide: TOKEN_ISSUER,
      useFactory: (env: Env) => TokenIssuer.create(env.privateKeyPem ? { privateKeyPem: env.privateKeyPem } : {}),
      inject: [JWT_ENV],
    },
    {
      provide: TOKEN_VERIFIER,
      useFactory: (issuer: TokenIssuer, clock: Clock) => localVerifier(issuer.jwks(), () => clock.now()),
      inject: [TOKEN_ISSUER, CLOCK],
    },
  ],
})
export class AppModule implements NestModule {
  /** `/health`, `/metrics` et journal `x-correlation-id`. */
  configure(consumer: MiddlewareConsumer): void {
    const quiet = process.env['NODE_ENV'] === 'test';
    const { middleware } = createObservability({ service: 'identite', ...(quiet ? { log: () => undefined } : {}) });
    consumer.apply(middleware).forRoutes('*path');
  }
}
