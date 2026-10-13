import { createFileRoute } from '@tanstack/react-router';
import { LeadsPage } from '@/features/platform/pages/leads-page';

export const Route = createFileRoute('/_app/platform/leads')({ component: LeadsPage });
