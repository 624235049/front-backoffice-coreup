import { createFileRoute } from '@tanstack/react-router';
import { UsageReportPage } from '@/features/platform/pages/usage-report-page';

export const Route = createFileRoute('/_app/platform/usage')({ component: UsageReportPage });
