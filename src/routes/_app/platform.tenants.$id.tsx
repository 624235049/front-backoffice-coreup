import { createFileRoute } from '@tanstack/react-router';
import { RequirePermission } from '@/components/require-permission';
import { TenantDetailPage } from '@/features/platform/pages/tenant-detail-page';

export const Route = createFileRoute('/_app/platform/tenants/$id')({
  component: () => (
    <RequirePermission permission="platform:shops">
      <TenantDetailPage />
    </RequirePermission>
  ),
});
