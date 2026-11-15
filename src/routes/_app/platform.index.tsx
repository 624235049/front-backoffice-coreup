import { createFileRoute } from '@tanstack/react-router';
import { RequirePermission } from '@/components/require-permission';
import { DashboardPage } from '@/features/platform/pages/dashboard-page';

export const Route = createFileRoute('/_app/platform/')({
  component: () => (
    <RequirePermission permission="platform:shops">
      <DashboardPage />
    </RequirePermission>
  ),
});
