'use client';

import { useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import type { Role } from '@hygia/types';
import { INVITABLE_ROLES, ROLE_LABEL_KEYS, type AdministrationViewModel } from '@hygia/view-models';
import { Button, Input } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Fenêtre « Inviter un utilisateur » : nom, e-mail, rôle et équipe facultative. */
export const InviteDialog = observer(function InviteDialog({
  vm,
  onClose,
}: {
  vm: AdministrationViewModel;
  onClose: () => void;
}) {
  const { t } = useSession();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('medecin');
  const [teamId, setTeamId] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await vm.invite({ email: email.trim(), displayName: displayName.trim(), role, ...(teamId ? { teamId } : {}) });
    if (ok) onClose();
  };

  return (
    <div className="modal-backdrop" onKeyDown={(event) => event.key === 'Escape' && onClose()}>
      <form role="dialog" aria-modal="true" aria-labelledby="invite-title" className="modal" onSubmit={(e) => void submit(e)}>
        <h2 id="invite-title">{t('administration.invite.title')}</h2>
        <Input label={t('administration.invite.name')} required autoFocus value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <Input label={t('administration.invite.email')} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="field">
          <label className="field-label" htmlFor="invite-role">
            {t('administration.invite.role')}
          </label>
          <select id="invite-role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {INVITABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(ROLE_LABEL_KEYS[r])}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="invite-team">
            {t('administration.invite.team')}
          </label>
          <select id="invite-team" className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">{t('administration.invite.noTeam')}</option>
            {vm.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
        {vm.error === null ? null : <p role="alert">{t(`administration.error.${vm.error}`)}</p>}
        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>
            {t('administration.invite.cancel')}
          </Button>
          <Button type="submit">{t('administration.invite.submit')}</Button>
        </div>
      </form>
    </div>
  );
});
