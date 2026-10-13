import { createFileRoute, redirect } from '@tanstack/react-router';
import { SignInPage } from '@/features/auth/pages/sign-in-page';
import { safeRedirect } from '@/lib/home';
import { meQueryOptions } from '@/lib/me';

export const Route = createFileRoute('/_auth/sign-in')({
  validateSearch: (s: Record<string, unknown>): { redirect?: string; error?: string } => ({
    redirect: safeRedirect(s.redirect),
    error: typeof s.error === 'string' ? s.error : undefined,
  }),
  // Already signed in -> straight to the app.
  beforeLoad: async ({ context, search }) => {
    const me = await context.queryClient
      .ensureQueryData({ ...meQueryOptions, retry: false })
      .catch(() => null);
    if (me) throw search.redirect ? redirect({ href: search.redirect }) : redirect({ to: '/' });
  },
  component: SignInPage,
});
