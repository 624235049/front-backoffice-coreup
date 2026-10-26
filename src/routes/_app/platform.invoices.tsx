import { createFileRoute } from '@tanstack/react-router';
import { InvoicesPage } from '@/features/platform/pages/invoices-page';

export const Route = createFileRoute('/_app/platform/invoices')({
  validateSearch: (s: Record<string, unknown>): { invoice?: string } => ({
    invoice: typeof s.invoice === 'string' && s.invoice ? s.invoice : undefined,
  }),
  component: InvoicesPage,
});
