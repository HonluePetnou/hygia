'use client';

import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { X } from 'lucide-react';
import type { AdministrationViewModel, TeamCard } from '@hygia/view-models';
import { Button, Input } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Une équipe : membres (ajout / retrait) et patients rattachés (identifiants). */
const TeamItem = observer(function TeamItem({ vm, team }: { vm: AdministrationViewModel; team: TeamCard }) {
  const { t } = useSession();
  const [patientId, setPatientId] = useState('');
  return (
    <li className="admin-team" data-testid={`team-${team.id}`}>
      <h3>{team.name}</h3>
      <p className="muted">{t('administration.teams.members', { count: team.members.length })}</p>
      {team.members.length === 0 ? <p className="muted">{t('administration.teams.noMembers')}</p> : null}
      <ul className="admin-chips">
        {team.members.map((member) => (
          <li key={member.id} className="admin-chip">
            {member.name}
            <button
              type="button"
              aria-label={t('administration.teams.removeMember', { name: member.name, team: team.name })}
              onClick={() => void vm.removeMember(team.id, member.id)}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <select
        className="input"
        aria-label={t('administration.teams.addMember', { team: team.name })}
        value=""
        onChange={(event) => event.target.value && void vm.addMember(team.id, event.target.value)}
      >
        <option value="">{t('administration.teams.addMember.choose')}</option>
        {team.candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name}
          </option>
        ))}
      </select>
      <p className="muted">{t('administration.teams.patients', { count: team.patientIds.length })}</p>
      {team.patientIds.length === 0 ? <p className="muted">{t('administration.teams.noPatients')}</p> : null}
      <ul className="admin-chips">
        {team.patientIds.map((id) => (
          <li key={id} className="admin-chip">
            <code>{id.slice(0, 8)}</code>
            <button
              type="button"
              aria-label={t('administration.teams.detach', { id: id.slice(0, 8), team: team.name })}
              onClick={() => void vm.detachPatient(team.id, id)}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="admin-inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (patientId.trim() !== '') void vm.attachPatient(team.id, patientId).then(() => setPatientId(''));
        }}
      >
        <Input
          label={t('administration.teams.patientId', { team: team.name })}
          value={patientId}
          onChange={(event) => setPatientId(event.target.value)}
        />
        <Button type="submit" variant="secondary">
          {t('administration.teams.attach')}
        </Button>
      </form>
    </li>
  );
});

/** Carte « Équipes de soins » : liste des équipes et création. */
export const TeamsPanel = observer(function TeamsPanel({ vm }: { vm: AdministrationViewModel }) {
  const { t } = useSession();
  const [name, setName] = useState('');
  return (
    <section className="card" aria-labelledby="administration-teams-title">
      <h2 id="administration-teams-title">{t('administration.teams.title')}</h2>
      {vm.teams.length === 0 ? <p className="muted">{t('administration.teams.empty')}</p> : null}
      <ul className="admin-teams">
        {vm.teams.map((team) => (
          <TeamItem key={team.id} vm={vm} team={team} />
        ))}
      </ul>
      <form
        className="admin-inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() !== '') void vm.createTeam(name).then(() => setName(''));
        }}
      >
        <Input label={t('administration.teams.name')} value={name} onChange={(event) => setName(event.target.value)} />
        <Button type="submit">{t('administration.teams.create')}</Button>
      </form>
    </section>
  );
});
