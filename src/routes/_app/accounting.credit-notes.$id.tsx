import { createFileRoute } from '@tanstack/react-router';
import { DocumentPage } from '@/features/accounting/pages/document-page';

export const Route = createFileRoute('/_app/accounting/credit-notes/$id')({
  component: DetailRoute,
});

function DetailRoute() {
  const { id } = Route.useParams();
  return <DocumentPage kind="credit_note" id={id} />;
}
