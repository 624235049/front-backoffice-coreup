import { createFileRoute } from '@tanstack/react-router';
import { DocumentPage } from '@/features/accounting/pages/document-page';

export const Route = createFileRoute('/_app/accounting/credit-notes/new')({
  component: () => <DocumentPage kind="credit_note" />,
});
