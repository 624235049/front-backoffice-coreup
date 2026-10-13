import { createFileRoute } from '@tanstack/react-router';
import { DashboardPage } from '@/features/platform/pages/dashboard-page';

export const Route = createFileRoute('/_app/platform/')({ component: DashboardPage });
