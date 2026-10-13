import { Link } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, NavList, useNav } from '@/components/app-shell/nav-list';
import { OfflineBanner } from '@/components/app-shell/offline-banner';
import { UserMenu } from '@/components/app-shell/user-menu';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

/**
 * Desktop/iPad landscape: sidebar + top bar. Phone/iPad portrait: top bar + bottom nav (+ drawer for the rest)
 * — docs/04 §6.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation('nav');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const groups = useNav();
  const primary = groups.flatMap((g) => g.items).slice(0, 4);

  return (
    <div className="flex min-h-dvh flex-col">
      <OfflineBanner />
      <div className="flex flex-1">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-4 overflow-y-auto bg-sidebar bg-[radial-gradient(120%_60%_at_0%_0%,rgba(92,203,196,0.14),transparent_60%)] p-3 text-sidebar-foreground lg:flex">
          <Link to="/" className="flex items-center gap-2 px-2 pb-1 pt-2 text-white">
            <Logo variant="wordmark-light" />
            <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
              Team
            </span>
          </Link>
          <NavList />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-white/90 px-3 backdrop-blur lg:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label={t('openMenu')}
            >
              <Menu />
            </Button>
            <div className="flex-1" />
            <UserMenu />
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 lg:px-8 lg:pb-8">{children}</main>
        </div>
      </div>

      <nav
        aria-label={t('primary')}
        className="pb-safe fixed inset-x-0 bottom-0 z-30 flex border-t bg-white/95 backdrop-blur lg:hidden"
      >
        {primary.map((item) => (
          <NavLink key={item.to} item={item} variant="bottom" />
        ))}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
        >
          <Menu className="size-5" aria-hidden />
          {t('more')}
        </button>
      </nav>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className="bg-sidebar p-3 text-sidebar-foreground"
          closeLabel={t('closeMenu')}
        >
          <SheetHeader className="p-0">
            <SheetTitle className="flex items-center gap-2 text-white">
              <Logo variant="wordmark-light" />
            </SheetTitle>
            <SheetDescription className="sr-only">{t('primary')}</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto">
            <NavList onNavigate={() => setDrawerOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
