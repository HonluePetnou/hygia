import { Inject, Injectable } from '@nestjs/common';
import type { TokenIssuer } from '@hygia/auth';
import type { Account } from '../accounts/account.js';
import { EmergencyService } from '../emergency/emergency.service.js';
import { TEAM_REPOSITORY, type TeamRepository } from '../teams/team-repository.js';
import { CLOCK, type Clock } from '../time/clock.js';

/** Jeton d'injection de `TokenIssuer`. */
export const TOKEN_ISSUER = Symbol('TOKEN_ISSUER');

/** Jeton émis avec son expiration (ISO 8601). */
export interface IssuedToken {
  accessToken: string;
  expiresAt: string;
}

/** Émet le jeton d'un compte avec ses équipes de soins et ses accès d'urgence actifs. */
@Injectable()
export class SessionTokens {
  constructor(
    @Inject(TOKEN_ISSUER) private readonly issuer: TokenIssuer,
    @Inject(TEAM_REPOSITORY) private readonly teams: TeamRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly emergency: EmergencyService,
  ) {}

  async issueFor(account: Account): Promise<IssuedToken> {
    const { token, expiresAt } = await this.issuer.issue(
      {
        sub: account.id,
        role: account.role,
        teams: this.teams.teamIdsOf(account.id),
        emergency: this.emergency.activeFor(account.id),
      },
      this.clock.now(),
    );
    return { accessToken: token, expiresAt: expiresAt.toISOString() };
  }
}
