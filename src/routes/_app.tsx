import { createFileRoute, Navigate, Outlet, redirect } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell/app-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { isApiError } from '@/lib/api';
import { signInSearch } from '@/lib/home';
import { meQueryOptions, useMe } from '@/lib/me';
import { MembershipProvider, pickPlatformMembership } from '@/lib/membership';
import { useSession } from '@/stores/session';

/** Authenticated layout: needs a session AND a membership in the CoreUp platform tenant, otherwise redirects. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    try {
      const data = await context.queryClient.ensureQueryData(meQueryOptions);
      const membership = pickPlatformMembership(data.memberships);
      if (!membership) throw redirect({ to: '/no-access' });
      useSession.getState().setTenant(membership.tenant.id);
    } catch (e) {
      if (isApiError(e) && e.status === 401) {
        throw redirect({ to: '/sign-in', search: signInSearch(location.href) });
      }
      throw e;
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const me = useMe();
  if (!me.data) {
    return (
      <div className="grid gap-3 p-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  const membership = pickPlatformMembership(me.data.memberships);
  if (!membership) return <Navigate to="/no-access" />;
  return (
    <MembershipProvider value={membership}>
      <AppShell>
        <Outlet />
      </AppShell>
    </MembershipProvider>
  );
}
