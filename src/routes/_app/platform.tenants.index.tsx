import { createFileRoute } from '@tanstack/react-router';
import { TenantsPage } from '@/features/platform/pages/tenants-page';

export const Route = createFileRoute('/_app/platform/tenants/')({ component: TenantsPage });
