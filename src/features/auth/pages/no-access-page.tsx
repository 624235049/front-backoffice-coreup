import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ShieldOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { signOutAndReset } from '@/components/app-shell/user-menu';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

/** Signed in, but the account has no membership in the CoreUp team tenant. */
export function NoAccessPage() {
  const { t } = useTranslation('auth');
  const qc = useQueryClient();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ivory px-4 text-center">
      <Logo variant="wordmark" className="h-14 w-auto" />
      <ShieldOff className="size-8 text-muted-foreground" aria-hidden />
      <h1 className="font-display text-xl font-semibold">{t('noAccess.title')}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t('noAccess.body')}</p>
      <Button
        onClick={() => {
          void signOutAndReset(qc).finally(() => void navigate({ to: '/sign-in', search: {} }));
        }}
      >
        {t('noAccess.signOut')}
      </Button>
    </div>
  );
}
