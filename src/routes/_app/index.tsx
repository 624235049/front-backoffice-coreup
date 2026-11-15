import { createFileRoute, redirect } from '@tanstack/react-router';
import { homeFor } from '@/lib/home';
import { meQueryOptions } from '@/lib/me';
import { pickPlatformMembership } from '@/lib/membership';

/** The team's home depends on the role: the dashboard, or the first page the role may use (sales: leads). */
export const Route = createFileRoute('/_app/')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions);
    const membership = pickPlatformMembership(me.memberships);
    throw redirect({ href: membership ? homeFor(membership) : '/platform' });
  },
});
