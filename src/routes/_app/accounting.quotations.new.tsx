import { createFileRoute } from '@tanstack/react-router';
import { DocumentPage } from '@/features/accounting/pages/document-page';

export const Route = createFileRoute('/_app/accounting/quotations/new')({
  component: () => <DocumentPage kind="quotation" />,
});
