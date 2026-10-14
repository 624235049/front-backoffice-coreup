import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/features/accounting/lib/url-search';
import { ContactsPage } from '@/features/accounting/pages/contacts-page';

export const Route = createFileRoute('/_app/accounting/contacts')({
  validateSearch: (s) => listSearchSchema.parse(s),
  component: ContactsPage,
});
