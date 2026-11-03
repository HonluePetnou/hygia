import { randomUUID } from 'node:crypto';
import { demoDataset } from '@hygia/fhir';

/** Jeton d'injection de `TeamRepository`. */
export const TEAM_REPOSITORY = Symbol('TEAM_REPOSITORY');

/** Équipe de soins : ensemble de comptes soignants et de patients rattachés. */
export interface CareTeam {
  /** UUID stable. */
  id: string;
  version: number;
  name: string;
  memberIds: string[];
  /** Patients rattachés à l'équipe (identifiants de dossier). */
  patientIds: string[];
}

/** Stockage des équipes de soins. */
export interface TeamRepository {
  list(): CareTeam[];
  findById(id: string): CareTeam | undefined;
  /** Identifiants des équipes dont le compte est membre. */
  teamIdsOf(accountId: string): string[];
  create(name: string): CareTeam;
  /** Ajoute un membre (idempotent) ; `undefined` si l'équipe n'existe pas. */
  addMember(teamId: string, accountId: string): CareTeam | undefined;
  /** Retire un membre (idempotent) ; `undefined` si l'équipe n'existe pas. */
  removeMember(teamId: string, accountId: string): CareTeam | undefined;
  /** Rattache un patient (idempotent) ; `undefined` si l'équipe n'existe pas. */
  attachPatient(teamId: string, patientId: string): CareTeam | undefined;
  /** Détache un patient (idempotent) ; `undefined` si l'équipe n'existe pas. */
  detachPatient(teamId: string, patientId: string): CareTeam | undefined;
}

type TeamList = 'memberIds' | 'patientIds';

/** Dépôt en mémoire. */
export class InMemoryTeamRepository implements TeamRepository {
  private readonly teams = new Map<string, CareTeam>();

  constructor(initial: CareTeam[] = []) {
    initial.forEach((team) => this.teams.set(team.id, team));
  }

  list(): CareTeam[] {
    return [...this.teams.values()];
  }

  findById(id: string): CareTeam | undefined {
    return this.teams.get(id);
  }

  teamIdsOf(accountId: string): string[] {
    return this.list()
      .filter((team) => team.memberIds.includes(accountId))
      .map((team) => team.id);
  }

  create(name: string): CareTeam {
    const team: CareTeam = { id: randomUUID(), version: 1, name, memberIds: [], patientIds: [] };
    this.teams.set(team.id, team);
    return team;
  }

  addMember(teamId: string, accountId: string): CareTeam | undefined {
    return this.change(teamId, 'memberIds', accountId, true);
  }

  removeMember(teamId: string, accountId: string): CareTeam | undefined {
    return this.change(teamId, 'memberIds', accountId, false);
  }

  attachPatient(teamId: string, patientId: string): CareTeam | undefined {
    return this.change(teamId, 'patientIds', patientId, true);
  }

  detachPatient(teamId: string, patientId: string): CareTeam | undefined {
    return this.change(teamId, 'patientIds', patientId, false);
  }

  /** Ajoute ou retire `value` d'une liste de l'équipe ; la version n'augmente que si la liste change. */
  private change(teamId: string, field: TeamList, value: string, add: boolean): CareTeam | undefined {
    const team = this.teams.get(teamId);
    if (team === undefined) return undefined;
    if (team[field].includes(value) === add) return team;
    const list = add ? [...team[field], value] : team[field].filter((v) => v !== value);
    const updated: CareTeam = { ...team, version: team.version + 1, [field]: list };
    this.teams.set(teamId, updated);
    return updated;
  }
}

/** Équipes du jeu de démonstration FHIR (Cardiologie : Dr Nana et Rose Mballa). */
export function demoTeams(): CareTeam[] {
  return demoDataset.careTeams.map((team) => ({
    id: team.id,
    version: team.version,
    name: team.name,
    memberIds: team.participants.map((p) => p.reference.split('/')[1] ?? ''),
    patientIds: demoDataset.patients
      .filter((p) => p.managingOrganization.reference === team.managingOrganization.reference)
      .map((p) => p.id),
  }));
}
