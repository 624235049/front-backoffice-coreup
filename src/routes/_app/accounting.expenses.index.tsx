import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/features/accounting/lib/url-search';
import { ExpensesPage } from '@/features/accounting/pages/expenses-page';

export const Route = createFileRoute('/_app/accounting/expenses/')({
  validateSearch: (s) => listSearchSchema.parse(s),
  component: ExpensesPage,
});
