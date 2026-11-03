import { makeAutoObservable, runInAction } from 'mobx';
import { ROLES, type Role } from '@hygia/types';
import type { AdministrationGateway } from './administration-gateway.js';
import { accountRows, teamCards, type AccountRow, type TeamCard } from './administration-rows.js';
import { SECURITY_POLICY, type AdministrationData, type InvitationInput } from './administration-types.js';
import { GatewayError } from './http-client.js';
import type { LoadState } from './load-state.js';
import type { LocaleSource } from './types.js';

/** Rôles proposables à l'invitation : tous ceux du système. */
export const INVITABLE_ROLES: readonly Role[] = ROLES;

/** Raison d'un échec d'action, traduite par l'écran (`administration.error.<code>`). */
export type ActionError = 'conflict' | 'invalid' | 'failed';

/** Contexte de la vue-modèle : langue et compte courant (un admin ne peut pas se désactiver). */
export interface AdministrationContext extends LocaleSource {
  readonly userId: string;
}

/** Écran « Administration » (maquette 11) : comptes, rôles, équipes de soins et politique de sécurité. */
export class AdministrationViewModel {
  state: LoadState = 'idle';
  data: AdministrationData | null = null;
  error: ActionError | null = null;
  /** Mot de passe provisoire de la dernière invitation, affiché une seule fois. */
  temporaryPassword: string | null = null;

  constructor(
    private readonly gateway: AdministrationGateway,
    private readonly context: AdministrationContext,
  ) {
    makeAutoObservable<AdministrationViewModel, 'gateway' | 'context'>(
      this,
      { gateway: false, context: false },
      { autoBind: true },
    );
  }

  async load(): Promise<void> {
    this.state = 'loading';
    await this.reload();
  }

  get rows(): AccountRow[] {
    return this.data === null ? [] : accountRows(this.data.accounts, this.data.teams, this.context);
  }

  get teams(): TeamCard[] {
    return this.data === null ? [] : teamCards(this.data.accounts, this.data.teams);
  }

  get policy() {
    return SECURITY_POLICY;
  }

  /** Vrai pour le compte connecté : ni rôle ni désactivation possibles sur soi-même. */
  isSelf(accountId: string): boolean {
    return accountId === this.context.userId;
  }

  async invite(input: InvitationInput): Promise<boolean> {
    this.temporaryPassword = null;
    const result = await this.run(() => this.gateway.invite(input));
    if (result === undefined) return false;
    runInAction(() => {
      this.temporaryPassword = result.temporaryPassword;
    });
    return true;
  }

  dismissPassword(): void {
    this.temporaryPassword = null;
  }

  changeRole(accountId: string, role: Role): Promise<boolean> {
    return this.act(() => this.gateway.changeRole(accountId, role));
  }

  resetMfa(accountId: string): Promise<boolean> {
    return this.act(() => this.gateway.resetMfa(accountId));
  }

  setActive(accountId: string, active: boolean): Promise<boolean> {
    return this.act(() => this.gateway.setActive(accountId, active));
  }

  createTeam(name: string): Promise<boolean> {
    return this.act(() => this.gateway.createTeam(name.trim()));
  }

  addMember(teamId: string, accountId: string): Promise<boolean> {
    return this.act(() => this.gateway.addMember(teamId, accountId));
  }

  removeMember(teamId: string, accountId: string): Promise<boolean> {
    return this.act(() => this.gateway.removeMember(teamId, accountId));
  }

  attachPatient(teamId: string, patientId: string): Promise<boolean> {
    return this.act(() => this.gateway.attachPatient(teamId, patientId.trim()));
  }

  detachPatient(teamId: string, patientId: string): Promise<boolean> {
    return this.act(() => this.gateway.detachPatient(teamId, patientId));
  }

  private async act(call: () => Promise<unknown>): Promise<boolean> {
    return (await this.run(call)) !== undefined;
  }

  /** Exécute l'action puis relit comptes et équipes ; `undefined` si elle a échoué. */
  private async run<T>(call: () => Promise<T>): Promise<T | undefined> {
    runInAction(() => {
      this.error = null;
    });
    try {
      const result = await call();
      await this.reload();
      return result;
    } catch (error) {
      runInAction(() => this.fail(error));
      return undefined;
    }
  }

  private async reload(): Promise<void> {
    try {
      const data = await this.gateway.load();
      runInAction(() => {
        this.data = data;
        this.state = 'ready';
      });
    } catch (error) {
      runInAction(() => this.fail(error, true));
    }
  }

  private fail(error: unknown, loading = false): void {
    const status = error instanceof GatewayError ? error.status : 0;
    if (status === 403) this.state = 'forbidden';
    else if (loading) {
      if (this.data === null) this.state = 'error';
    } else this.error = status === 409 ? 'conflict' : status === 400 ? 'invalid' : 'failed';
  }
}
