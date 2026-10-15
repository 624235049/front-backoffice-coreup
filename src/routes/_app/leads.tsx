import { createFileRoute, redirect } from '@tanstack/react-router';

/** Short link used in the team's LINE alert ("ดูที่ admin.coreup.biz/leads"). */
export const Route = createFileRoute('/_app/leads')({
  beforeLoad: () => {
    throw redirect({ to: '/platform/leads' });
  },
});
