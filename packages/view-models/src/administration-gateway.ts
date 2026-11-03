import type {
  AdminAccount,
  AdminTeam,
  AdministrationData,
  InvitationInput,
  InvitationResult,
} from './administration-types.js';
import type { Role } from '@hygia/types';

/** Administration des comptes, rôles et équipes (service Identité, rôle admin). */
export interface AdministrationGateway {
  load(): Promise<AdministrationData>;
  invite(input: InvitationInput): Promise<InvitationResult>;
  changeRole(accountId: string, role: Role): Promise<AdminAccount>;
  resetMfa(accountId: string): Promise<AdminAccount>;
  setActive(accountId: string, active: boolean): Promise<AdminAccount>;
  createTeam(name: string): Promise<AdminTeam>;
  addMember(teamId: string, accountId: string): Promise<AdminTeam>;
  removeMember(teamId: string, accountId: string): Promise<AdminTeam>;
  attachPatient(teamId: string, patientId: string): Promise<AdminTeam>;
  detachPatient(teamId: string, patientId: string): Promise<AdminTeam>;
}
