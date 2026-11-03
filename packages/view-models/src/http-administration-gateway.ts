import type { Role } from '@hygia/types';
import type { AdministrationGateway } from './administration-gateway.js';
import type {
  AdminAccount,
  AdminTeam,
  AdministrationData,
  InvitationInput,
  InvitationResult,
} from './administration-types.js';
import { HttpClient } from './http-client.js';
import type { Identity } from './types.js';

/** Passerelle HTTP vers le service Identité par le broker (`/api/identite`). */
export class HttpAdministrationGateway implements AdministrationGateway {
  private readonly client: HttpClient;

  constructor(baseUrl: string, identity: () => Identity, fetchFn?: typeof fetch) {
    this.client = new HttpClient(baseUrl, identity, fetchFn);
  }

  async load(): Promise<AdministrationData> {
    const [accounts, teams] = await Promise.all([
      this.client.get<AdminAccount[]>('/comptes'),
      this.client.get<AdminTeam[]>('/equipes'),
    ]);
    return { accounts, teams };
  }

  invite(input: InvitationInput): Promise<InvitationResult> {
    return this.client.post('/comptes/invitations', input);
  }

  changeRole(accountId: string, role: Role): Promise<AdminAccount> {
    return this.client.post(`/comptes/${accountId}/role`, { role });
  }

  resetMfa(accountId: string): Promise<AdminAccount> {
    return this.client.post(`/comptes/${accountId}/reinitialiser-2fa`, {});
  }

  setActive(accountId: string, active: boolean): Promise<AdminAccount> {
    return this.client.post(`/comptes/${accountId}/${active ? 'reactiver' : 'desactiver'}`, {});
  }

  createTeam(name: string): Promise<AdminTeam> {
    return this.client.post('/equipes', { name });
  }

  addMember(teamId: string, accountId: string): Promise<AdminTeam> {
    return this.client.post(`/equipes/${teamId}/membres`, { accountId });
  }

  removeMember(teamId: string, accountId: string): Promise<AdminTeam> {
    return this.client.post(`/equipes/${teamId}/membres/retirer`, { accountId });
  }

  attachPatient(teamId: string, patientId: string): Promise<AdminTeam> {
    return this.client.post(`/equipes/${teamId}/patients`, { patientId });
  }

  detachPatient(teamId: string, patientId: string): Promise<AdminTeam> {
    return this.client.post(`/equipes/${teamId}/patients/retirer`, { patientId });
  }
}
