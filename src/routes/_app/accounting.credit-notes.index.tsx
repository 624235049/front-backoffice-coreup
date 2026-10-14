import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/features/accounting/lib/url-search';
import { DocumentListPage } from '@/features/accounting/pages/document-list-page';

export const Route = createFileRoute('/_app/accounting/credit-notes/')({
  validateSearch: (s) => listSearchSchema.parse(s),
  component: () => <DocumentListPage kind="credit_note" />,
});
