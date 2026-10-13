import { createFileRoute } from '@tanstack/react-router';
import { RevenuePage } from '@/features/platform/pages/revenue-page';

export const Route = createFileRoute('/_app/platform/revenue')({ component: RevenuePage });
