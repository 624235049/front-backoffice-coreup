import { createFileRoute } from '@tanstack/react-router';
import { SalesPage } from '@/features/platform/pages/sales-page';

export const Route = createFileRoute('/_app/platform/sales')({
  validateSearch: (s: Record<string, unknown>): { lead?: string } => ({
    lead: typeof s.lead === 'string' && s.lead ? s.lead : undefined,
  }),
  component: SalesPage,
});
