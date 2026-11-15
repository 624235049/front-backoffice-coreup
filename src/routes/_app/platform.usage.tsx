import { createFileRoute } from '@tanstack/react-router';
import { RequirePermission } from '@/components/require-permission';
import { UsageReportPage } from '@/features/platform/pages/usage-report-page';

export const Route = createFileRoute('/_app/platform/usage')({
  component: () => (
    <RequirePermission permission="platform:shops">
      <UsageReportPage />
    </RequirePermission>
  ),
});
