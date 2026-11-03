'use client';

import { observer } from 'mobx-react-lite';
import { KeyRound, UserCheck, UserX } from 'lucide-react';
import { INVITABLE_ROLES, ROLE_LABEL_KEYS, type AdministrationViewModel } from '@hygia/view-models';
import { Badge, Button } from '@/components/ui';
import { useSession } from '@/lib/session-context';

/** Tableau des utilisateurs : rôle modifiable, 2FA, dernière connexion et actions de compte. */
export const UsersTable = observer(function UsersTable({ vm }: { vm: AdministrationViewModel }) {
  const { t } = useSession();
  return (
    <table className="data-table">
      <caption className="sr-only">{t('administration.users.title')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('administration.col.name')}</th>
          <th scope="col">{t('administration.col.role')}</th>
          <th scope="col">{t('administration.col.teams')}</th>
          <th scope="col">{t('administration.col.mfa')}</th>
          <th scope="col">{t('administration.col.lastLogin')}</th>
          <th scope="col">{t('administration.col.actions')}</th>
        </tr>
      </thead>
      <tbody>
        {vm.rows.map((row) => (
          <tr key={row.id} data-testid={`account-${row.id}`} className={row.active ? undefined : 'admin-row-inactive'}>
            <td>
              <strong>{row.name}</strong>
              <div className="muted">{row.email}</div>
              {row.active ? null : <Badge tone="danger">{t('administration.inactive')}</Badge>}
            </td>
            <td>
              <select
                className="input admin-role-select"
                aria-label={t('administration.role.change', { name: row.name })}
                value={row.role}
                disabled={vm.isSelf(row.id)}
                onChange={(event) => void vm.changeRole(row.id, event.target.value as typeof row.role)}
              >
                {INVITABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {t(ROLE_LABEL_KEYS[role])}
                  </option>
                ))}
              </select>
            </td>
            <td>{row.teamNames.length === 0 ? t('administration.noTeam') : row.teamNames.join(', ')}</td>
            <td>
              <Badge tone={row.mfaEnrolled ? 'success' : 'warning'}>
                {t(row.mfaEnrolled ? 'administration.mfa.on' : 'administration.mfa.off')}
              </Badge>
            </td>
            <td className="time">{row.lastLoginLabel}</td>
            <td className="admin-actions">
              <Button
                variant="ghost"
                aria-label={t('administration.mfa.reset', { name: row.name })}
                title={t('administration.mfa.reset', { name: row.name })}
                onClick={() => void vm.resetMfa(row.id)}
              >
                <KeyRound size={16} aria-hidden="true" />
              </Button>
              {row.active ? (
                <Button
                  variant="ghost"
                  disabled={vm.isSelf(row.id)}
                  aria-label={t('administration.deactivate', { name: row.name })}
                  title={t('administration.deactivate', { name: row.name })}
                  onClick={() => void vm.setActive(row.id, false)}
                >
                  <UserX size={16} aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  aria-label={t('administration.reactivate', { name: row.name })}
                  title={t('administration.reactivate', { name: row.name })}
                  onClick={() => void vm.setActive(row.id, true)}
                >
                  <UserCheck size={16} aria-hidden="true" />
                </Button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
});
