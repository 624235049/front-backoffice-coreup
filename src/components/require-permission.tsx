import { Link } from '@tanstack/react-router';
import { ShieldOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { homeFor } from '@/lib/home';
import { useMembership } from '@/lib/membership';
import { can } from '@/lib/permissions';

/** Friendly "no permission" page with a way back to the member's own home. */
export function NoPermission() {
  const { t } = useTranslation('common');
  const home = homeFor(useMembership());
  return (
    <EmptyState
      icon={ShieldOff}
      title={t('noPermission.title')}
      description={t('noPermission.body')}
      action={
        <Button asChild>
          <Link to={home as never}>{t('noPermission.home')}</Link>
        </Button>
      }
    />
  );
}

/** Direct-URL guard for a page whose menu item is hidden from some roles. The API enforces the same permission. */
export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const allowed = can(useMembership().permissions, permission);
  return allowed ? children : <NoPermission />;
}
