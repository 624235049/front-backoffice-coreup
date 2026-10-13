import { createFileRoute } from '@tanstack/react-router';
import { AuditsPage } from '@/features/platform/pages/audits-page';

export const Route = createFileRoute('/_app/platform/audits/')({ component: AuditsPage });
