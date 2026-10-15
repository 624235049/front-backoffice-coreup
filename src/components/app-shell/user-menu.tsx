import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Languages, LogOut, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api, unwrap } from '@/lib/api';
import { initialsOf } from '@/lib/initials';
import { useMe } from '@/lib/me';
import { useSession } from '@/stores/session';

export async function signOutAndReset(queryClient: ReturnType<typeof useQueryClient>) {
  try {
    await unwrap(api.POST('/v1/auth/sign-out'));
  } finally {
    useSession.getState().reset();
    queryClient.clear();
  }
}

export function UserMenu() {
  const { t } = useTranslation('nav');
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const locale = useSession((s) => s.locale);
  const setLocale = useSession((s) => s.setLocale);
  const user = me.data?.user;
  const name = user?.name || user?.email || '?';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t('userMenu')}
      >
        <Avatar className="size-10">
          <AvatarFallback>{initialsOf(name, '?')}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">{user?.name}</span>
          {user?.email ? <span className="font-normal">{user.email}</span> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setLocale(locale === 'th' ? 'en' : 'th')}>
          <Languages aria-hidden />
          {locale === 'th' ? 'English' : 'ภาษาไทย'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigate({ to: '/account/security' })}>
          <ShieldCheck aria-hidden />
          {t('security')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            signOutAndReset(qc)
              .catch(() => toast.error(t('signOutFailed')))
              .finally(() => void navigate({ to: '/sign-in', search: {} }));
          }}
        >
          <LogOut aria-hidden />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
