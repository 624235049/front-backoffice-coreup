import { createFileRoute, redirect } from '@tanstack/react-router';

/** The CoreUp team's home is the dashboard. */
export const Route = createFileRoute('/_app/')({
  beforeLoad: () => {
    throw redirect({ to: '/platform' });
  },
});
