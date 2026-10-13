import { createFileRoute } from '@tanstack/react-router';
import { EngagementsPage } from '@/features/platform/pages/engagements-page';

export const Route = createFileRoute('/_app/platform/engagements/')({ component: EngagementsPage });
