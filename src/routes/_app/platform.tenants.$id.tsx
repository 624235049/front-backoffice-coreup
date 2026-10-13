import { createFileRoute } from '@tanstack/react-router';
import { TenantDetailPage } from '@/features/platform/pages/tenant-detail-page';

export const Route = createFileRoute('/_app/platform/tenants/$id')({ component: TenantDetailPage });
