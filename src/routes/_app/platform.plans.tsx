import { createFileRoute } from '@tanstack/react-router';
import { PlansPage } from '@/features/platform/pages/plans-page';

export const Route = createFileRoute('/_app/platform/plans')({ component: PlansPage });
