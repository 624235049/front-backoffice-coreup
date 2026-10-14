import { createFileRoute } from '@tanstack/react-router';
import { ExpenseFormPage } from '@/features/accounting/pages/expense-form-page';

export const Route = createFileRoute('/_app/accounting/expenses/new')({
  component: () => <ExpenseFormPage />,
});
