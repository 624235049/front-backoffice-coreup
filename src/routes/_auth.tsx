import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Logo } from '@/components/logo';

/** Layout for pages that do not need a session: sign-in, invite, password reset. Brand panel matches coreup.pro. */
export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
});

function AuthLayout() {
  const { t } = useTranslation('auth');
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative isolate hidden overflow-hidden bg-sidebar text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <img
          src="/images/hero-clinic.webp"
          alt=""
          aria-hidden
          className="absolute inset-0 -z-20 h-full w-full object-cover opacity-60"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-br from-sidebar via-sidebar/85 to-sidebar/30"
        />
        <Logo variant="wordmark-light" className="h-12 w-auto self-start" />
        <div className="max-w-md">
          <p className="text-xs font-medium tracking-[0.28em] text-white/75">{t('panel.kicker')}</p>
          <h2 className="mt-5 text-4xl font-bold leading-tight">
            <span className="block">{t('panel.titleA')}</span>
            <span className="block text-mint-400">{t('panel.titleB')}</span>
          </h2>
          <p className="mt-5 leading-7 text-white/80">{t('panel.line')}</p>
        </div>
        <p className="text-sm text-white/60">© CoreUp · Business Systems &amp; Consulting</p>
      </aside>
      <main className="flex flex-col items-center justify-center gap-6 bg-canvas px-4 py-10">
        <h1 className="lg:hidden">
          <Logo variant="full" className="h-24 w-auto" />
        </h1>
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
