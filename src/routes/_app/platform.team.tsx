import { createFileRoute } from '@tanstack/react-router';
import { TeamPage } from '@/features/platform/pages/team-page';

export const Route = createFileRoute('/_app/platform/team')({ component: TeamPage });
