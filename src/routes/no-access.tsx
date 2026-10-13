import { createFileRoute, redirect } from '@tanstack/react-router';
import { NoAccessPage } from '@/features/auth/pages/no-access-page';
import { isApiError } from '@/lib/api';
import { signInSearch } from '@/lib/home';
import { meQueryOptions } from '@/lib/me';

export const Route = createFileRoute('/no-access')({
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(meQueryOptions);
    } catch (e) {
      if (isApiError(e) && e.status === 401)
        throw redirect({ to: '/sign-in', search: signInSearch(location.href) });
      throw e;
    }
  },
  component: NoAccessPage,
});
