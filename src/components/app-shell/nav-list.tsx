import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useMembership, useUiMode } from '@/lib/membership';
import { allNavItems, buildNav, type NavItem } from '@/lib/navigation';
import { cn } from '@/lib/utils';

export function useNav() {
  const m = useMembership();
  const mode = useUiMode();
  return buildNav(allNavItems, m, mode);
}

function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function NavLink({
  item,
  onNavigate,
  variant = 'sidebar',
}: {
  item: NavItem;
  onNavigate?: () => void;
  variant?: 'sidebar' | 'bottom';
}) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = isActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      to={item.to as never}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        variant === 'sidebar'
          ? 'relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors'
          : 'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
        variant === 'sidebar'
          ? active
            ? 'bg-white/10 text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-sidebar-primary [&>svg]:text-sidebar-primary'
            : 'text-sidebar-foreground/75 hover:bg-white/5 hover:text-white'
          : active
            ? 'text-primary before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full before:bg-mint-500 [&>svg]:text-mint-600'
            : 'text-muted-foreground',
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className="truncate">{t(item.labelKey)}</span>
    </Link>
  );
}

/** Sidebar / drawer navigation, grouped by section. */
export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation('nav');
  const groups = useNav();
  return (
    <nav aria-label={t('primary')} className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.section} className="flex flex-col gap-1">
          {g.section !== 'main' ? (
            <div className="px-3 pb-1 text-xs font-medium tracking-wide text-sidebar-muted uppercase">
              {t(`section.${g.section}`)}
            </div>
          ) : null}
          {g.items.map((item) => (
            <NavLink key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}
