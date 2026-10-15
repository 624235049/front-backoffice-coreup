import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { UserRow } from '../api';

/** Role key → Thai label (CoreUp roles, shop system roles, else the raw key of a custom role). */
export function useRoleLabel() {
  const { t } = useTranslation('users');
  return (key: string) => t(`role.${key}`, { defaultValue: key });
}

/** Status chips: never colour alone (docs/04 §6). */
export function UserBadges({
  u,
}: {
  u: Pick<UserRow, 'isTeam' | 'twoFactorEnabled' | 'lineLinked' | 'hasPassword'>;
}) {
  const { t } = useTranslation('users');
  return (
    <div className="flex flex-wrap gap-1.5">
      {u.isTeam ? <Badge variant="default">{t('badge.team')}</Badge> : null}
      {u.twoFactorEnabled ? <Badge variant="success">{t('badge.twoFactor')}</Badge> : null}
      {u.lineLinked ? <Badge variant="secondary">{t('badge.line')}</Badge> : null}
      {u.hasPassword ? null : <Badge variant="warning">{t('badge.noPassword')}</Badge>}
    </div>
  );
}

/** Shops the account belongs to with its roles in each. */
export function UserMemberships({ u }: { u: Pick<UserRow, 'memberships'> }) {
  const { t } = useTranslation('users');
  const roleLabel = useRoleLabel();
  if (u.memberships.length === 0) return <span className="text-sm text-muted-foreground">{t('noShop')}</span>;
  return (
    <ul className="grid gap-1.5">
      {u.memberships.map((m) => (
        <li key={m.membershipId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium">{m.tenantName}</span>
          <span className="text-muted-foreground">
            {m.roles.length > 0 ? m.roles.map(roleLabel).join(', ') : '–'}
          </span>
          {m.status === 'active' ? null : <Badge variant="secondary">{t(`memberStatus.${m.status}`)}</Badge>}
        </li>
      ))}
    </ul>
  );
}
