import type { Role } from '@hygia/types';
import type { AdministrationGateway } from './administration-gateway.js';
import type {
  AdminAccount,
  AdminTeam,
  AdministrationData,
  InvitationInput,
  InvitationResult,
} from './administration-types.js';
import { GatewayError } from './http-client.js';

const CARDIOLOGIE = '00000000-0000-4000-8000-0b0000000001';

const account = (
  n: number,
  displayName: string,
  email: string,
  role: Role,
  extra: Partial<AdminAccount> = {},
): AdminAccount => ({
  id: `00000000-0000-4000-8000-02000000000${n}`,
  displayName,
  email,
  role,
  mfaEnrolled: true,
  active: true,
  lastLoginAt: '2026-11-03T08:12:00.000Z',
  teamIds: [],
  ...extra,
});

/** Comptes fictifs de la maquette « Administration ». */
function seedAccounts(): AdminAccount[] {
  return [
    account(1, 'Dr Aïcha Nana', 'aicha.nana@hd-bonassama.cm', 'medecin', { teamIds: [CARDIOLOGIE] }),
    account(2, 'Rose Mballa', 'rose.mballa@hd-bonassama.cm', 'infirmier', { teamIds: [CARDIOLOGIE] }),
    account(3, 'Dr Paul Kamga', 'paul.kamga@cma-bepanda.cm', 'medecin', { mfaEnrolled: false, lastLoginAt: null }),
    account(5, 'Marthe Eyenga', 'marthe.eyenga@hd-bonassama.cm', 'administratif'),
    account(7, 'Lionel Tchakounte', 'admin@hygia.local', 'admin'),
  ];
}

/**
 * Administration en mémoire (démonstration hors ligne et tests). `audited` reçoit une ligne par action,
 * comme le journal du service Identité.
 */
export class InMemoryAdministrationGateway implements AdministrationGateway {
  readonly audited: string[] = [];
  private accounts: AdminAccount[] = seedAccounts();
  private teams: AdminTeam[] = [
    { id: CARDIOLOGIE, version: 1, name: 'Cardiologie', memberIds: [this.accounts[0]?.id ?? '', this.accounts[1]?.id ?? ''], patientIds: ['p-1', 'p-2'] },
  ];

  async load(): Promise<AdministrationData> {
    return { accounts: this.accounts.map((a) => ({ ...a })), teams: this.teams.map((t) => ({ ...t })) };
  }

  async invite(input: InvitationInput): Promise<InvitationResult> {
    if (this.accounts.some((a) => a.email.toLowerCase() === input.email.toLowerCase())) {
      throw new GatewayError(409, 'POST /comptes/invitations');
    }
    const created: AdminAccount = {
      id: `00000000-0000-4000-8000-0200000001${String(this.accounts.length).padStart(2, '0')}`,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      mfaEnrolled: false,
      active: true,
      lastLoginAt: null,
      teamIds: input.teamId === undefined ? [] : [input.teamId],
    };
    this.accounts = [...this.accounts, created];
    if (input.teamId !== undefined) await this.addMember(input.teamId, created.id);
    this.audited.push(`invitation:${created.id}`);
    return { account: created, temporaryPassword: 'Tmp-demo-4821' };
  }

  async changeRole(accountId: string, role: Role): Promise<AdminAccount> {
    this.audited.push(`role:${accountId}:${role}`);
    return this.patch(accountId, { role });
  }

  async resetMfa(accountId: string): Promise<AdminAccount> {
    this.audited.push(`2fa:${accountId}`);
    return this.patch(accountId, { mfaEnrolled: false });
  }

  async setActive(accountId: string, active: boolean): Promise<AdminAccount> {
    this.audited.push(`${active ? 'reactivation' : 'desactivation'}:${accountId}`);
    return this.patch(accountId, { active });
  }

  async createTeam(name: string): Promise<AdminTeam> {
    const team: AdminTeam = { id: `team-${this.teams.length + 1}`, version: 1, name, memberIds: [], patientIds: [] };
    this.teams = [...this.teams, team];
    this.audited.push(`equipe:${team.id}`);
    return team;
  }

  async addMember(teamId: string, accountId: string): Promise<AdminTeam> {
    this.audited.push(`membre+:${teamId}:${accountId}`);
    this.patchAccount(accountId, (a) => ({ ...a, teamIds: [...new Set([...a.teamIds, teamId])] }));
    return this.editTeam(teamId, (t) => ({ ...t, memberIds: [...new Set([...t.memberIds, accountId])] }));
  }

  async removeMember(teamId: string, accountId: string): Promise<AdminTeam> {
    this.audited.push(`membre-:${teamId}:${accountId}`);
    this.patchAccount(accountId, (a) => ({ ...a, teamIds: a.teamIds.filter((id) => id !== teamId) }));
    return this.editTeam(teamId, (t) => ({ ...t, memberIds: t.memberIds.filter((id) => id !== accountId) }));
  }

  async attachPatient(teamId: string, patientId: string): Promise<AdminTeam> {
    this.audited.push(`patient+:${teamId}:${patientId}`);
    return this.editTeam(teamId, (t) => ({ ...t, patientIds: [...new Set([...t.patientIds, patientId])] }));
  }

  async detachPatient(teamId: string, patientId: string): Promise<AdminTeam> {
    this.audited.push(`patient-:${teamId}:${patientId}`);
    return this.editTeam(teamId, (t) => ({ ...t, patientIds: t.patientIds.filter((id) => id !== patientId) }));
  }

  private patch(accountId: string, changes: Partial<AdminAccount>): AdminAccount {
    return this.patchAccount(accountId, (a) => ({ ...a, ...changes }));
  }

  private patchAccount(accountId: string, edit: (a: AdminAccount) => AdminAccount): AdminAccount {
    const found = this.accounts.find((a) => a.id === accountId);
    if (found === undefined) throw new GatewayError(404, `POST /comptes/${accountId}`);
    const updated = edit(found);
    this.accounts = this.accounts.map((a) => (a.id === accountId ? updated : a));
    return updated;
  }

  private editTeam(teamId: string, edit: (t: AdminTeam) => AdminTeam): AdminTeam {
    const found = this.teams.find((t) => t.id === teamId);
    if (found === undefined) throw new GatewayError(404, `POST /equipes/${teamId}`);
    const updated = { ...edit(found), version: found.version + 1 };
    this.teams = this.teams.map((t) => (t.id === teamId ? updated : t));
    return updated;
  }
}
