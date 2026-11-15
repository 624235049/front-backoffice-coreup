import { createFileRoute } from '@tanstack/react-router';
import { RequirePermission } from '@/components/require-permission';
import { TenantsPage } from '@/features/platform/pages/tenants-page';

export const Route = createFileRoute('/_app/platform/tenants/')({
  component: () => (
    <RequirePermission permission="platform:shops">
      <TenantsPage />
    </RequirePermission>
  ),
});
