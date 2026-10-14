import { createFileRoute } from '@tanstack/react-router';
import { reportSearchSchema } from '@/features/accounting/lib/url-search';
import { ReportsPage } from '@/features/accounting/pages/reports-page';

export const Route = createFileRoute('/_app/accounting/reports')({
  validateSearch: (s) => reportSearchSchema.parse(s),
  component: ReportsPage,
});
