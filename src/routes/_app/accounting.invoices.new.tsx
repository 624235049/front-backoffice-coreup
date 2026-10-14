import { createFileRoute } from '@tanstack/react-router';
import { DocumentPage } from '@/features/accounting/pages/document-page';

export const Route = createFileRoute('/_app/accounting/invoices/new')({
  component: () => <DocumentPage kind="invoice" />,
});
