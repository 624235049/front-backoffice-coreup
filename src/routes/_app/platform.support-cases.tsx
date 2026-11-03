import { createFileRoute } from '@tanstack/react-router';
import { SupportCasesPage } from '@/features/platform/pages/support-cases-page';

export const Route = createFileRoute('/_app/platform/support-cases')({ component: SupportCasesPage });
